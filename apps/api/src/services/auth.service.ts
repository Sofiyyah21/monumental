import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import jwt, { type SignOptions } from "jsonwebtoken";
import { Prisma, UserRole } from "@prisma/client";
import { getEnv } from "../config/env.js";
import { AppError } from "../lib/app-error.js";
import type { DatabaseClient, TransactionClient } from "../lib/database.js";

export type CreateUserInput = {
  email: string;
  name: string;
  password: string;
  role: UserRole;
};

export type PublicUser = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
};

export class AuthService {
  constructor(private readonly db: DatabaseClient) {}

  async registerCustomer(input: Omit<CreateUserInput, "role">) {
    return this.createUser({ ...input, role: UserRole.CUSTOMER });
  }

  async createUser(input: CreateUserInput) {
    const passwordHash = await bcrypt.hash(
      input.password,
      getEnv().BCRYPT_SALT_ROUNDS,
    );

    try {
      const user = await this.db.user.create({
        data: {
          email: input.email,
          name: input.name,
          passwordHash,
          role: input.role,
        },
      });
      return this.toPublicUser(user);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new AppError(
          "A user with this email already exists",
          409,
          "USER_EXISTS",
        );
      }
      throw error;
    }
  }

  async login(email: string, password: string) {
    const user = await this.db.user.findUnique({ where: { email } });
    if (!user || !user.active) {
      throw new AppError(
        "Invalid email or password",
        401,
        "INVALID_CREDENTIALS",
      );
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatches) {
      throw new AppError(
        "Invalid email or password",
        401,
        "INVALID_CREDENTIALS",
      );
    }

    const refreshToken = await this.createRefreshToken(user.id);
    return {
      user: this.toPublicUser(user),
      accessToken: this.createAccessToken(user),
      refreshToken,
    };
  }

  async refresh(refreshToken: string) {
    const tokenHash = this.hashRefreshToken(refreshToken);
    return this.db.$transaction(async (tx) => {
      const stored = await tx.refreshToken.findUnique({
        where: { tokenHash },
        include: { user: true },
      });

      if (
        !stored ||
        stored.revokedAt ||
        stored.expiresAt <= new Date() ||
        !stored.user.active
      ) {
        throw new AppError(
          "Invalid or expired refresh token",
          401,
          "INVALID_REFRESH_TOKEN",
        );
      }

      const revoked = await tx.refreshToken.updateMany({
        where: { id: stored.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });

      if (revoked.count !== 1) {
        throw new AppError(
          "Invalid or expired refresh token",
          401,
          "INVALID_REFRESH_TOKEN",
        );
      }

      const newRefreshToken = await this.createRefreshToken(stored.userId, tx);
      return {
        user: this.toPublicUser(stored.user),
        accessToken: this.createAccessToken(stored.user),
        refreshToken: newRefreshToken,
      };
    });
  }

  async logout(refreshToken: string) {
    await this.db.refreshToken.updateMany({
      where: {
        tokenHash: this.hashRefreshToken(refreshToken),
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });
  }

  async getCurrentUser(userId: string) {
    const user = await this.db.user.findUnique({ where: { id: userId } });
    if (!user || !user.active) {
      throw new AppError("User not found", 404, "USER_NOT_FOUND");
    }
    return this.toPublicUser(user);
  }

  private createAccessToken(user: {
    id: string;
    email: string;
    role: UserRole;
  }) {
    const env = getEnv();
    return jwt.sign(
      {
        email: user.email,
        role: user.role,
      },
      env.JWT_ACCESS_SECRET,
      {
        subject: user.id,
        expiresIn: env.ACCESS_TOKEN_EXPIRES_IN as SignOptions["expiresIn"],
      },
    );
  }

  private async createRefreshToken(
    userId: string,
    tx: DatabaseClient | TransactionClient = this.db,
  ) {
    const refreshToken = crypto.randomBytes(64).toString("hex");
    const expiresAt = new Date(
      Date.now() + getEnv().REFRESH_TOKEN_EXPIRES_IN_DAYS * 24 * 60 * 60 * 1000,
    );

    await tx.refreshToken.create({
      data: {
        userId,
        tokenHash: this.hashRefreshToken(refreshToken),
        expiresAt,
      },
    });

    return refreshToken;
  }

  private hashRefreshToken(refreshToken: string) {
    return crypto.createHash("sha256").update(refreshToken).digest("hex");
  }

  private toPublicUser(user: {
    id: string;
    email: string;
    name: string;
    role: UserRole;
  }) {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    } satisfies PublicUser;
  }
}
