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

type ProductRecord = {
  id: string;
  name: string;
  sku: string;
  category: ProductCategory;
  unit: ProductUnit;
  costPrice: Prisma.Decimal;
  sellingPrice: Prisma.Decimal;
  currentStock: Prisma.Decimal;
  reorderLevel: Prisma.Decimal;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
};

type UserWhere = { id?: string; email?: string };
type UserSelect = Partial<Record<keyof UserRecord, boolean>>;
type ProductWhere = {
  id?: string;
  sku?: string;
  category?: ProductCategory;
  unit?: ProductUnit;
  active?: boolean;
  OR?: Array<{
    name?: { contains: string; mode?: "insensitive" };
    sku?: { contains: string; mode?: "insensitive" };
  }>;
};

function uniqueConstraintError() {
  return new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
    code: "P2002",
    clientVersion: "test",
  });
}

function recordNotFoundError() {
  return new Prisma.PrismaClientKnownRequestError("Record not found", {
    code: "P2025",
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
  const products = new Map<string, ProductRecord>();
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

  const findProduct = (where: ProductWhere) => {
    if (where.id) {
      return products.get(where.id);
    }
    if (where.sku) {
      return [...products.values()].find(
        (product) => product.sku === where.sku,
      );
    }
    return undefined;
  };

  const matchesSearchFilter = (
    product: ProductRecord,
    filter: NonNullable<ProductWhere["OR"]>[number],
  ) => {
    const [field, condition] = filter.name
      ? (["name", filter.name] as const)
      : (["sku", filter.sku] as const);
    if (!condition) {
      return false;
    }

    const actual = product[field];
    const expected = condition.contains;
    if (condition.mode === "insensitive") {
      return actual.toLowerCase().includes(expected.toLowerCase());
    }
    return actual.includes(expected);
  };

  const matchesProductWhere = (
    product: ProductRecord,
    where?: ProductWhere,
  ) => {
    if (!where) {
      return true;
    }
    if (where.category && product.category !== where.category) {
      return false;
    }
    if (where.unit && product.unit !== where.unit) {
      return false;
    }
    if (where.active !== undefined && product.active !== where.active) {
      return false;
    }
    if (
      where.OR &&
      !where.OR.some((filter) => matchesSearchFilter(product, filter))
    ) {
      return false;
    }
    return true;
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
      async findMany(options?: { where?: ProductWhere }) {
        return [...products.values()]
          .filter((product) => matchesProductWhere(product, options?.where))
          .map((product) => ({ ...product }));
      },
      async findUnique(options: { where: ProductWhere }) {
        const product = findProduct(options.where);
        return product ? { ...product } : null;
      },
      async create(options: {
        data: {
          name: string;
          sku: string;
          category: ProductCategory;
          unit: ProductUnit;
          costPrice: number;
          sellingPrice: number;
          reorderLevel: number;
        };
      }) {
        if (findProduct({ sku: options.data.sku })) {
          throw uniqueConstraintError();
        }

        const now = new Date();
        const product: ProductRecord = {
          id: `product_${productSequence}`,
          name: options.data.name,
          sku: options.data.sku,
          category: options.data.category,
          unit: options.data.unit,
          costPrice: new Prisma.Decimal(options.data.costPrice),
          sellingPrice: new Prisma.Decimal(options.data.sellingPrice),
          currentStock: new Prisma.Decimal(0),
          reorderLevel: new Prisma.Decimal(options.data.reorderLevel),
          active: true,
          createdAt: now,
          updatedAt: now,
        };
        productSequence += 1;
        products.set(product.id, product);
        return { ...product };
      },
      async update(options: {
        where: ProductWhere;
        data: Partial<{
          name: string;
          sku: string;
          category: ProductCategory;
          unit: ProductUnit;
          costPrice: number;
          sellingPrice: number;
          reorderLevel: number;
          active: boolean;
        }>;
      }) {
        const product = findProduct(options.where);
        if (!product) {
          throw recordNotFoundError();
        }
        if (
          options.data.sku &&
          [...products.values()].some(
            (candidate) =>
              candidate.id !== product.id && candidate.sku === options.data.sku,
          )
        ) {
          throw uniqueConstraintError();
        }

        const updatedProduct: ProductRecord = {
          ...product,
          ...options.data,
          costPrice:
            options.data.costPrice === undefined
              ? product.costPrice
              : new Prisma.Decimal(options.data.costPrice),
          sellingPrice:
            options.data.sellingPrice === undefined
              ? product.sellingPrice
              : new Prisma.Decimal(options.data.sellingPrice),
          reorderLevel:
            options.data.reorderLevel === undefined
              ? product.reorderLevel
              : new Prisma.Decimal(options.data.reorderLevel),
          updatedAt: new Date(),
        };
        products.set(product.id, updatedProduct);
        return { ...updatedProduct };
      },
      async updateMany() {
        return { count: 0 };
      },
      async count(options?: { where?: ProductWhere }) {
        return [...products.values()].filter((product) =>
          matchesProductWhere(product, options?.where),
        ).length;
      },
      async deleteMany() {
        const count = products.size;
        products.clear();
        return { count };
      },
      async findUniqueOrThrow(options: { where: ProductWhere }) {
        const product = findProduct(options.where);
        if (!product) {
          throw recordNotFoundError();
        }
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
