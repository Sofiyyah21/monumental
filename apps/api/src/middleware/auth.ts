import jwt from "jsonwebtoken";
import type { NextFunction, Request, Response } from "express";
import { UserRole } from "@prisma/client";
import { getEnv } from "../config/env.js";
import {
  roleHasPermission,
  type Permission,
} from "../authorization/permissions.js";
import type { DatabaseClient } from "../lib/database.js";
import { AppError } from "../lib/app-error.js";
import { prisma } from "../lib/prisma.js";

type AccessTokenPayload = {
  sub: string;
  email: string;
  role: UserRole;
};

function getBearerToken(req: Request) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return undefined;
  }
  return header.slice("Bearer ".length);
}

function isAccessTokenPayload(payload: unknown): payload is AccessTokenPayload {
  if (!payload || typeof payload !== "object") {
    return false;
  }

  const candidate = payload as Partial<
    Record<keyof AccessTokenPayload, unknown>
  >;
  return (
    typeof candidate.sub === "string" &&
    candidate.sub.length > 0 &&
    typeof candidate.email === "string" &&
    Object.values(UserRole).includes(candidate.role as UserRole)
  );
}

export function createAuthenticate(db: DatabaseClient) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    const token = getBearerToken(req);
    if (!token) {
      next(new AppError("Authentication required", 401, "AUTH_REQUIRED"));
      return;
    }

    let payload: AccessTokenPayload;
    try {
      const verifiedPayload = jwt.verify(token, getEnv().JWT_ACCESS_SECRET);
      if (!isAccessTokenPayload(verifiedPayload)) {
        next(
          new AppError(
            "Invalid or expired access token",
            401,
            "INVALID_ACCESS_TOKEN",
          ),
        );
        return;
      }
      payload = verifiedPayload;
    } catch {
      next(
        new AppError(
          "Invalid or expired access token",
          401,
          "INVALID_ACCESS_TOKEN",
        ),
      );
      return;
    }

    try {
      const user = await db.user.findUnique({
        where: { id: payload.sub },
        select: { id: true, email: true, role: true, active: true },
      });

      if (
        !user ||
        !user.active ||
        user.email !== payload.email ||
        user.role !== payload.role
      ) {
        next(
          new AppError(
            "Invalid or expired access token",
            401,
            "INVALID_ACCESS_TOKEN",
          ),
        );
        return;
      }

      req.user = {
        id: user.id,
        email: user.email,
        role: user.role,
      };
      next();
    } catch (error) {
      next(error);
    }
  };
}

export const authenticate = createAuthenticate(prisma);

export function authorize(...allowedRoles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      next(new AppError("Authentication required", 401, "AUTH_REQUIRED"));
      return;
    }
    if (
      req.user.role !== UserRole.ADMIN &&
      !allowedRoles.includes(req.user.role)
    ) {
      next(
        new AppError(
          "You do not have permission to perform this action",
          403,
          "FORBIDDEN",
        ),
      );
      return;
    }
    next();
  };
}

export function authorizePermission(permission: Permission) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      next(new AppError("Authentication required", 401, "AUTH_REQUIRED"));
      return;
    }
    if (!roleHasPermission(req.user.role, permission)) {
      next(
        new AppError(
          "You do not have permission to perform this action",
          403,
          "FORBIDDEN",
        ),
      );
      return;
    }
    next();
  };
}
