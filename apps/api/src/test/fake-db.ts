import { Prisma, ProductCategory, ProductUnit, UserRole } from "@prisma/client";
import type { DatabaseClient } from "../lib/database.js";

type UserRecord = {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  role: UserRole;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
};

type RefreshTokenRecord = {
  id: string;
  tokenHash: string;
  userId: string;
  expiresAt: Date;
  revokedAt: Date | null;
  createdAt: Date;
};

type UserWhere = { id?: string; email?: string };
type UserSelect = Partial<Record<keyof UserRecord, boolean>>;

function uniqueConstraintError() {
  return new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
    code: "P2002",
    clientVersion: "test",
  });
}

function projectUser(user: UserRecord | undefined, select?: UserSelect) {
  if (!user) {
    return null;
  }
  if (!select) {
    return { ...user };
  }

  const projected: Partial<UserRecord> = {};
  for (const key of Object.keys(select) as Array<keyof UserRecord>) {
    if (select[key]) {
      projected[key] = user[key] as never;
    }
  }
  return projected;
}

export function createFakeDatabase() {
  const users = new Map<string, UserRecord>();
  const refreshTokens = new Map<string, RefreshTokenRecord>();
  const products: Array<Record<string, unknown>> = [];
  let userSequence = 1;
  let refreshTokenSequence = 1;
  let productSequence = 1;

  const findUser = (where: UserWhere) => {
    if (where.id) {
      return users.get(where.id);
    }
    if (where.email) {
      return [...users.values()].find((user) => user.email === where.email);
    }
    return undefined;
  };

  const db = {
    user: {
      async create(options: {
        data: {
          email: string;
          name: string;
          passwordHash: string;
          role: UserRole;
        };
      }) {
        if (findUser({ email: options.data.email })) {
          throw uniqueConstraintError();
        }

        const now = new Date();
        const user: UserRecord = {
          id: `user_${userSequence}`,
          email: options.data.email,
          name: options.data.name,
          passwordHash: options.data.passwordHash,
          role: options.data.role,
          active: true,
          createdAt: now,
          updatedAt: now,
        };
        userSequence += 1;
        users.set(user.id, user);
        return { ...user };
      },
      async findUnique(options: { where: UserWhere; select?: UserSelect }) {
        return projectUser(findUser(options.where), options.select);
      },
    },
    refreshToken: {
      async create(options: {
        data: { userId: string; tokenHash: string; expiresAt: Date };
      }) {
        const refreshToken: RefreshTokenRecord = {
          id: `refresh_${refreshTokenSequence}`,
          tokenHash: options.data.tokenHash,
          userId: options.data.userId,
          expiresAt: options.data.expiresAt,
          revokedAt: null,
          createdAt: new Date(),
        };
        refreshTokenSequence += 1;
        refreshTokens.set(refreshToken.tokenHash, refreshToken);
        return { ...refreshToken };
      },
      async findUnique(options: {
        where: { tokenHash: string };
        include?: { user?: boolean };
      }) {
        const refreshToken = refreshTokens.get(options.where.tokenHash);
        if (!refreshToken) {
          return null;
        }
        if (options.include?.user) {
          return {
            ...refreshToken,
            user: { ...users.get(refreshToken.userId)! },
          };
        }
        return { ...refreshToken };
      },
      async updateMany(options: {
        where: { id?: string; tokenHash?: string; revokedAt?: null };
        data: { revokedAt: Date };
      }) {
        let count = 0;
        for (const refreshToken of refreshTokens.values()) {
          const idMatches =
            !options.where.id || refreshToken.id === options.where.id;
          const hashMatches =
            !options.where.tokenHash ||
            refreshToken.tokenHash === options.where.tokenHash;
          const revokedMatches =
            options.where.revokedAt !== null || refreshToken.revokedAt === null;
          if (idMatches && hashMatches && revokedMatches) {
            refreshToken.revokedAt = options.data.revokedAt;
            count += 1;
          }
        }
        return { count };
      },
    },
    product: {
      async findMany() {
        return products.map((product) => ({ ...product }));
      },
      async create(options: {
        data: {
          name: string;
          category: ProductCategory;
          unit: ProductUnit;
          costPrice: number;
          sellingPrice: number;
          lowStockThreshold: number;
        };
      }) {
        const now = new Date();
        const product = {
          id: `product_${productSequence}`,
          ...options.data,
          currentStock: new Prisma.Decimal(0),
          active: true,
          createdAt: now,
          updatedAt: now,
        };
        productSequence += 1;
        products.push(product);
        return { ...product };
      },
    },
    sale: {
      async findMany() {
        return [];
      },
    },
    async $transaction<T>(callback: (tx: DatabaseClient) => Promise<T>) {
      return callback(db as unknown as DatabaseClient);
    },
  };

  return {
    db: db as unknown as DatabaseClient,
    users,
    refreshTokens,
  };
}
