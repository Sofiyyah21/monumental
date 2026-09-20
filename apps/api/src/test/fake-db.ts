import {
  OrderPaymentStatus,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  Prisma,
  ProductCategory,
  ProductUnit,
  SaleStatus,
  StockMovementType,
  UserRole,
} from "@prisma/client";
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
  id?: string | { in?: string[] };
  sku?: string;
  currentStock?: { gte?: Prisma.Decimal };
  category?: ProductCategory;
  unit?: ProductUnit;
  active?: boolean;
  OR?: Array<{
    name?: { contains: string; mode?: "insensitive" };
    sku?: { contains: string; mode?: "insensitive" };
  }>;
};

type SaleRecord = {
  id: string;
  reference: string;
  sellerId: string;
  customerId: string | null;
  status: SaleStatus;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  paymentReference: string | null;
  subtotal: Prisma.Decimal;
  discountAmount: Prisma.Decimal;
  totalAmount: Prisma.Decimal;
  totalCost: Prisma.Decimal;
  grossProfit: Prisma.Decimal;
  voidedAt: Date | null;
  voidedById: string | null;
  voidReason: string | null;
  soldAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

type SaleItemRecord = {
  id: string;
  saleId: string;
  productId: string;
  productName: string;
  productUnit: ProductUnit;
  quantity: Prisma.Decimal;
  unitPrice: Prisma.Decimal;
  unitCost: Prisma.Decimal;
  lineTotal: Prisma.Decimal;
  lineCost: Prisma.Decimal;
  grossProfit: Prisma.Decimal;
};

type SaleWhere = {
  id?: string;
  reference?: string;
  sellerId?: string;
  customerId?: string;
  status?: SaleStatus;
  paymentStatus?: PaymentStatus;
  soldAt?: {
    gte?: Date;
    lte?: Date;
    lt?: Date;
  };
};

type SaleItemWhere = {
  sale?: SaleWhere;
  productId?: string;
  productUnit?: ProductUnit;
  product?: {
    category?: ProductCategory;
  };
};

type OrderRecord = {
  id: string;
  reference: string;
  customerId: string;
  status: OrderStatus;
  paymentStatus: OrderPaymentStatus;
  subtotal: Prisma.Decimal;
  confirmedAt: Date | null;
  confirmedById: string | null;
  paidAt: Date | null;
  paidById: string | null;
  fulfilledAt: Date | null;
  fulfilledById: string | null;
  cancelledAt: Date | null;
  cancelledById: string | null;
  cancelReason: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type OrderItemRecord = {
  id: string;
  orderId: string;
  productId: string;
  productName: string;
  productSku: string;
  productCategory: ProductCategory;
  productUnit: ProductUnit;
  quantity: Prisma.Decimal;
  unitPrice: Prisma.Decimal;
  lineSubtotal: Prisma.Decimal;
  createdAt: Date;
};

type OrderWhere = {
  id?: string;
  reference?: string;
  customerId?: string;
  status?: OrderStatus;
  paymentStatus?: OrderPaymentStatus;
  createdAt?: {
    gte?: Date;
    lte?: Date;
  };
};

type StockMovementRecord = {
  id: string;
  productId: string;
  type: StockMovementType;
  quantity: Prisma.Decimal;
  previousStock: Prisma.Decimal;
  newStock: Prisma.Decimal;
  unitCost: Prisma.Decimal | null;
  reference: string | null;
  note: string | null;
  saleId: string | null;
  createdById: string | null;
  occurredAt: Date;
};

type StockMovementWhere = {
  productId?: string;
  type?: StockMovementType;
  saleId?: string;
  occurredAt?: {
    gte?: Date;
    lte?: Date;
  };
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
  const stockMovements = new Map<string, StockMovementRecord>();
  const sales = new Map<string, SaleRecord>();
  const saleItems = new Map<string, SaleItemRecord>();
  const orders = new Map<string, OrderRecord>();
  const orderItems = new Map<string, OrderItemRecord>();
  let userSequence = 1;
  let refreshTokenSequence = 1;
  let productSequence = 1;
  let stockMovementSequence = 1;
  let saleSequence = 1;
  let saleItemSequence = 1;
  let saleReferenceSequence = 1;
  let orderSequence = 1;
  let orderItemSequence = 1;
  let orderReferenceSequence = 1;

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
    if (typeof where.id === "string") {
      return products.get(where.id);
    }
    if (where.sku) {
      return [...products.values()].find(
        (product) => product.sku === where.sku,
      );
    }
    return undefined;
  };

  const productIdMatches = (
    product: ProductRecord,
    id?: ProductWhere["id"],
  ) => {
    if (!id) {
      return true;
    }
    if (typeof id === "string") {
      return product.id === id;
    }
    return id.in?.includes(product.id) ?? true;
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
    if (!productIdMatches(product, where.id)) {
      return false;
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
      where.currentStock?.gte &&
      new Prisma.Decimal(product.currentStock).lt(where.currentStock.gte)
    ) {
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

  const matchesStockMovementWhere = (
    movement: StockMovementRecord,
    where?: StockMovementWhere,
  ) => {
    if (!where) {
      return true;
    }
    if (where.productId && movement.productId !== where.productId) {
      return false;
    }
    if (where.type && movement.type !== where.type) {
      return false;
    }
    if (where.saleId && movement.saleId !== where.saleId) {
      return false;
    }
    if (where.occurredAt?.gte && movement.occurredAt < where.occurredAt.gte) {
      return false;
    }
    if (where.occurredAt?.lte && movement.occurredAt > where.occurredAt.lte) {
      return false;
    }
    return true;
  };

  const includeStockMovementRelations = (
    movement: StockMovementRecord,
    include?: {
      product?: boolean;
      createdBy?: { select?: Partial<Record<keyof UserRecord, boolean>> };
    },
  ) => ({
    ...movement,
    product: include?.product
      ? { ...products.get(movement.productId)! }
      : undefined,
    createdBy:
      include?.createdBy && movement.createdById
        ? projectUser(users.get(movement.createdById), include.createdBy.select)
        : undefined,
  });

  const matchesSaleWhere = (sale: SaleRecord, where?: SaleWhere) => {
    if (!where) {
      return true;
    }
    if (where.id && sale.id !== where.id) {
      return false;
    }
    if (where.reference && sale.reference !== where.reference) {
      return false;
    }
    if (where.sellerId && sale.sellerId !== where.sellerId) {
      return false;
    }
    if (where.customerId && sale.customerId !== where.customerId) {
      return false;
    }
    if (where.status && sale.status !== where.status) {
      return false;
    }
    if (where.paymentStatus && sale.paymentStatus !== where.paymentStatus) {
      return false;
    }
    if (where.soldAt?.gte && sale.soldAt < where.soldAt.gte) {
      return false;
    }
    if (where.soldAt?.lte && sale.soldAt > where.soldAt.lte) {
      return false;
    }
    if (where.soldAt?.lt && sale.soldAt >= where.soldAt.lt) {
      return false;
    }
    return true;
  };

  const matchesSaleItemWhere = (
    item: SaleItemRecord,
    where?: SaleItemWhere,
  ) => {
    if (!where) {
      return true;
    }
    if (where.productId && item.productId !== where.productId) {
      return false;
    }
    if (where.productUnit && item.productUnit !== where.productUnit) {
      return false;
    }
    if (where.product?.category) {
      const product = products.get(item.productId);
      if (!product || product.category !== where.product.category) {
        return false;
      }
    }
    if (where.sale) {
      const sale = sales.get(item.saleId);
      if (!sale || !matchesSaleWhere(sale, where.sale)) {
        return false;
      }
    }
    return true;
  };

  const includeSaleRelations = (
    sale: SaleRecord,
    include?: {
      seller?: { select?: UserSelect };
      customer?: { select?: UserSelect };
      voidedBy?: { select?: UserSelect };
      items?: boolean;
    },
  ) => ({
    ...sale,
    seller: include?.seller
      ? projectUser(users.get(sale.sellerId), include.seller.select)
      : undefined,
    customer:
      include?.customer && sale.customerId
        ? projectUser(users.get(sale.customerId), include.customer.select)
        : null,
    voidedBy:
      include?.voidedBy && sale.voidedById
        ? projectUser(users.get(sale.voidedById), include.voidedBy.select)
        : null,
    items: include?.items
      ? [...saleItems.values()]
          .filter((item) => item.saleId === sale.id)
          .map((item) => ({ ...item }))
      : undefined,
  });

  const matchesOrderWhere = (order: OrderRecord, where?: OrderWhere) => {
    if (!where) {
      return true;
    }
    if (where.id && order.id !== where.id) {
      return false;
    }
    if (where.reference && order.reference !== where.reference) {
      return false;
    }
    if (where.customerId && order.customerId !== where.customerId) {
      return false;
    }
    if (where.status && order.status !== where.status) {
      return false;
    }
    if (where.paymentStatus && order.paymentStatus !== where.paymentStatus) {
      return false;
    }
    if (where.createdAt?.gte && order.createdAt < where.createdAt.gte) {
      return false;
    }
    if (where.createdAt?.lte && order.createdAt > where.createdAt.lte) {
      return false;
    }
    return true;
  };

  const includeOrderRelations = (
    order: OrderRecord,
    include?: { items?: boolean },
  ) => ({
    ...order,
    items: include?.items
      ? [...orderItems.values()]
          .filter((item) => item.orderId === order.id)
          .map((item) => ({ ...item }))
      : undefined,
  });

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
          currentStock:
            | Prisma.Decimal
            | { increment?: Prisma.Decimal; decrement?: Prisma.Decimal };
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

        const currentStock =
          options.data.currentStock instanceof Prisma.Decimal
            ? options.data.currentStock
            : options.data.currentStock?.increment
              ? product.currentStock.plus(options.data.currentStock.increment)
              : options.data.currentStock?.decrement
                ? product.currentStock.minus(
                    options.data.currentStock.decrement,
                  )
                : product.currentStock;

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
          currentStock,
          reorderLevel:
            options.data.reorderLevel === undefined
              ? product.reorderLevel
              : new Prisma.Decimal(options.data.reorderLevel),
          updatedAt: new Date(),
        };
        products.set(product.id, updatedProduct);
        return { ...updatedProduct };
      },
      async updateMany(options: {
        where: ProductWhere;
        data: {
          currentStock?: {
            increment?: Prisma.Decimal;
            decrement?: Prisma.Decimal;
          };
        };
      }) {
        const matchingProducts = [...products.values()].filter((product) =>
          matchesProductWhere(product, options.where),
        );

        for (const product of matchingProducts) {
          const currentStock = options.data.currentStock?.increment
            ? product.currentStock.plus(options.data.currentStock.increment)
            : options.data.currentStock?.decrement
              ? product.currentStock.minus(options.data.currentStock.decrement)
              : product.currentStock;
          products.set(product.id, {
            ...product,
            currentStock,
            updatedAt: new Date(),
          });
        }

        return { count: matchingProducts.length };
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
    stockMovement: {
      async create(options: {
        data: {
          productId: string;
          type: StockMovementType;
          quantity: Prisma.Decimal;
          previousStock: Prisma.Decimal;
          newStock: Prisma.Decimal;
          unitCost?: Prisma.Decimal;
          reference?: string;
          note?: string;
          saleId?: string;
          createdById?: string;
          occurredAt?: Date;
        };
      }) {
        const movement: StockMovementRecord = {
          id: `movement_${stockMovementSequence}`,
          productId: options.data.productId,
          type: options.data.type,
          quantity: options.data.quantity,
          previousStock: options.data.previousStock,
          newStock: options.data.newStock,
          unitCost: options.data.unitCost ?? null,
          reference: options.data.reference ?? null,
          note: options.data.note ?? null,
          saleId: options.data.saleId ?? null,
          createdById: options.data.createdById ?? null,
          occurredAt: options.data.occurredAt ?? new Date(),
        };
        stockMovementSequence += 1;
        stockMovements.set(movement.id, movement);
        return { ...movement };
      },
      async findMany(options?: {
        where?: StockMovementWhere;
        include?: {
          product?: boolean;
          createdBy?: { select?: Partial<Record<keyof UserRecord, boolean>> };
        };
        take?: number;
      }) {
        return [...stockMovements.values()]
          .filter((movement) =>
            matchesStockMovementWhere(movement, options?.where),
          )
          .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime())
          .slice(0, options?.take)
          .map((movement) =>
            includeStockMovementRelations(movement, options?.include),
          );
      },
      async count(options?: { where?: StockMovementWhere }) {
        return [...stockMovements.values()].filter((movement) =>
          matchesStockMovementWhere(movement, options?.where),
        ).length;
      },
      async deleteMany(options?: { where?: StockMovementWhere }) {
        const matchingIds = [...stockMovements.values()]
          .filter((movement) =>
            matchesStockMovementWhere(movement, options?.where),
          )
          .map((movement) => movement.id);
        for (const id of matchingIds) {
          stockMovements.delete(id);
        }
        return { count: matchingIds.length };
      },
    },
    sale: {
      async findMany(options?: {
        where?: SaleWhere;
        include?: {
          seller?: { select?: UserSelect };
          customer?: { select?: UserSelect };
          voidedBy?: { select?: UserSelect };
          items?: boolean;
        };
        take?: number;
      }) {
        return [...sales.values()]
          .filter((sale) => matchesSaleWhere(sale, options?.where))
          .sort((a, b) => b.soldAt.getTime() - a.soldAt.getTime())
          .slice(0, options?.take)
          .map((sale) => includeSaleRelations(sale, options?.include));
      },
      async findUnique(options: {
        where: SaleWhere;
        include?: {
          seller?: { select?: UserSelect };
          customer?: { select?: UserSelect };
          voidedBy?: { select?: UserSelect };
          items?: boolean;
        };
      }) {
        const sale = [...sales.values()].find((candidate) =>
          matchesSaleWhere(candidate, options.where),
        );
        return sale ? includeSaleRelations(sale, options.include) : null;
      },
      async create(options: {
        data: {
          reference: string;
          sellerId: string;
          customerId?: string;
          status: SaleStatus;
          paymentMethod: PaymentMethod;
          paymentStatus: PaymentStatus;
          paymentReference?: string;
          subtotal: Prisma.Decimal;
          discountAmount: Prisma.Decimal;
          totalAmount: Prisma.Decimal;
          totalCost: Prisma.Decimal;
          grossProfit: Prisma.Decimal;
          soldAt?: Date;
          items: {
            create: Array<{
              productId: string;
              productName: string;
              productUnit: ProductUnit;
              quantity: Prisma.Decimal;
              unitPrice: Prisma.Decimal;
              unitCost: Prisma.Decimal;
              lineTotal: Prisma.Decimal;
              lineCost: Prisma.Decimal;
              grossProfit: Prisma.Decimal;
            }>;
          };
        };
        include?: {
          seller?: { select?: UserSelect };
          customer?: { select?: UserSelect };
          items?: boolean;
        };
      }) {
        if (
          [...sales.values()].some(
            (sale) => sale.reference === options.data.reference,
          )
        ) {
          throw uniqueConstraintError();
        }

        const now = new Date();
        const sale: SaleRecord = {
          id: `sale_${saleSequence}`,
          reference: options.data.reference,
          sellerId: options.data.sellerId,
          customerId: options.data.customerId ?? null,
          status: options.data.status,
          paymentMethod: options.data.paymentMethod,
          paymentStatus: options.data.paymentStatus,
          paymentReference: options.data.paymentReference ?? null,
          subtotal: options.data.subtotal,
          discountAmount: options.data.discountAmount,
          totalAmount: options.data.totalAmount,
          totalCost: options.data.totalCost,
          grossProfit: options.data.grossProfit,
          voidedAt: null,
          voidedById: null,
          voidReason: null,
          soldAt: options.data.soldAt ?? now,
          createdAt: now,
          updatedAt: now,
        };
        saleSequence += 1;
        sales.set(sale.id, sale);

        for (const itemInput of options.data.items.create) {
          const item: SaleItemRecord = {
            id: `sale_item_${saleItemSequence}`,
            saleId: sale.id,
            ...itemInput,
          };
          saleItemSequence += 1;
          saleItems.set(item.id, item);
        }

        return includeSaleRelations(sale, options.include);
      },
      async update(options: {
        where: SaleWhere;
        data: Partial<{
          status: SaleStatus;
          voidedAt: Date;
          voidedById: string;
          voidReason: string;
        }>;
        include?: {
          seller?: { select?: UserSelect };
          customer?: { select?: UserSelect };
          voidedBy?: { select?: UserSelect };
          items?: boolean;
        };
      }) {
        const sale = [...sales.values()].find((candidate) =>
          matchesSaleWhere(candidate, options.where),
        );
        if (!sale) {
          throw recordNotFoundError();
        }

        const updatedSale: SaleRecord = {
          ...sale,
          status: options.data.status ?? sale.status,
          voidedAt: options.data.voidedAt ?? sale.voidedAt,
          voidedById: options.data.voidedById ?? sale.voidedById,
          voidReason: options.data.voidReason ?? sale.voidReason,
          updatedAt: new Date(),
        };
        sales.set(sale.id, updatedSale);
        return includeSaleRelations(updatedSale, options.include);
      },
      async count(options?: { where?: SaleWhere }) {
        return [...sales.values()].filter((sale) =>
          matchesSaleWhere(sale, options?.where),
        ).length;
      },
      async aggregate(options: {
        where?: SaleWhere;
        _count?: { id?: true };
        _sum?: Partial<Record<keyof SaleRecord, true>>;
      }) {
        const matchingSales = [...sales.values()].filter((sale) =>
          matchesSaleWhere(sale, options.where),
        );
        const sums: Record<string, Prisma.Decimal | null> = {};
        for (const field of Object.keys(options._sum ?? {})) {
          sums[field] =
            matchingSales.length === 0
              ? null
              : matchingSales.reduce(
                  (sum, sale) =>
                    sum.plus(
                      (sale as unknown as Record<string, Prisma.Decimal>)[
                        field
                      ],
                    ),
                  new Prisma.Decimal(0),
                );
        }

        return {
          _count: { id: options._count?.id ? matchingSales.length : 0 },
          _sum: sums,
        };
      },
      async deleteMany(options?: { where?: SaleWhere }) {
        const matchingIds = [...sales.values()]
          .filter((sale) => matchesSaleWhere(sale, options?.where))
          .map((sale) => sale.id);
        for (const id of matchingIds) {
          sales.delete(id);
          for (const item of saleItems.values()) {
            if (item.saleId === id) {
              saleItems.delete(item.id);
            }
          }
        }
        return { count: matchingIds.length };
      },
    },
    saleItem: {
      async aggregate(options: {
        where?: SaleItemWhere;
        _sum?: Partial<Record<keyof SaleItemRecord, true>>;
      }) {
        const matchingItems = [...saleItems.values()].filter((item) =>
          matchesSaleItemWhere(item, options.where),
        );
        const sums: Record<string, Prisma.Decimal | null> = {};
        for (const field of Object.keys(options._sum ?? {})) {
          sums[field] =
            matchingItems.length === 0
              ? null
              : matchingItems.reduce(
                  (sum, item) =>
                    sum.plus(
                      (item as unknown as Record<string, Prisma.Decimal>)[
                        field
                      ],
                    ),
                  new Prisma.Decimal(0),
                );
        }

        return { _sum: sums };
      },
      async groupBy(options: {
        by: Array<"productId" | "productName" | "productUnit">;
        where?: SaleItemWhere;
        _sum?: Partial<Record<keyof SaleItemRecord, true>>;
      }) {
        const groups = new Map<string, SaleItemRecord[]>();
        for (const item of saleItems.values()) {
          if (!matchesSaleItemWhere(item, options.where)) {
            continue;
          }

          const key = options.by.map((field) => item[field]).join("::");
          groups.set(key, [...(groups.get(key) ?? []), item]);
        }

        return [...groups.values()].map((items) => {
          const [firstItem] = items;
          const sums: Record<string, Prisma.Decimal | null> = {};
          for (const field of Object.keys(options._sum ?? {})) {
            sums[field] = items.reduce(
              (sum, item) =>
                sum.plus(
                  (item as unknown as Record<string, Prisma.Decimal>)[field],
                ),
              new Prisma.Decimal(0),
            );
          }

          return {
            productId: firstItem!.productId,
            productName: firstItem!.productName,
            productUnit: firstItem!.productUnit,
            _sum: sums,
          };
        });
      },
    },
    order: {
      async findMany(options?: {
        where?: OrderWhere;
        include?: { items?: boolean };
        take?: number;
      }) {
        return [...orders.values()]
          .filter((order) => matchesOrderWhere(order, options?.where))
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
          .slice(0, options?.take)
          .map((order) => includeOrderRelations(order, options?.include));
      },
      async findUnique(options: {
        where: OrderWhere;
        include?: { items?: boolean };
      }) {
        const order = [...orders.values()].find((candidate) =>
          matchesOrderWhere(candidate, options.where),
        );
        return order ? includeOrderRelations(order, options.include) : null;
      },
      async create(options: {
        data: {
          reference: string;
          customerId: string;
          status: OrderStatus;
          paymentStatus: OrderPaymentStatus;
          subtotal: Prisma.Decimal;
          createdAt?: Date;
          items: {
            create: Array<{
              productId: string;
              productName: string;
              productSku: string;
              productCategory: ProductCategory;
              productUnit: ProductUnit;
              quantity: Prisma.Decimal;
              unitPrice: Prisma.Decimal;
              lineSubtotal: Prisma.Decimal;
              createdAt?: Date;
            }>;
          };
        };
        include?: { items?: boolean };
      }) {
        if (
          [...orders.values()].some(
            (order) => order.reference === options.data.reference,
          )
        ) {
          throw uniqueConstraintError();
        }

        const now = new Date();
        const order: OrderRecord = {
          id: `order_${orderSequence}`,
          reference: options.data.reference,
          customerId: options.data.customerId,
          status: options.data.status,
          paymentStatus: options.data.paymentStatus,
          subtotal: options.data.subtotal,
          confirmedAt: null,
          confirmedById: null,
          paidAt: null,
          paidById: null,
          fulfilledAt: null,
          fulfilledById: null,
          cancelledAt: null,
          cancelledById: null,
          cancelReason: null,
          createdAt: options.data.createdAt ?? now,
          updatedAt: now,
        };
        orderSequence += 1;
        orders.set(order.id, order);

        for (const itemInput of options.data.items.create) {
          const item: OrderItemRecord = {
            id: `order_item_${orderItemSequence}`,
            orderId: order.id,
            ...itemInput,
            createdAt: itemInput.createdAt ?? now,
          };
          orderItemSequence += 1;
          orderItems.set(item.id, item);
        }

        return includeOrderRelations(order, options.include);
      },
      async update(options: {
        where: OrderWhere;
        data: Partial<{
          status: OrderStatus;
          paymentStatus: OrderPaymentStatus;
          confirmedAt: Date;
          confirmedById: string | null;
          paidAt: Date;
          paidById: string | null;
          fulfilledAt: Date;
          fulfilledById: string | null;
          cancelledAt: Date;
          cancelledById: string | null;
          cancelReason: string | null;
        }>;
        include?: { items?: boolean };
      }) {
        const order = [...orders.values()].find((candidate) =>
          matchesOrderWhere(candidate, options.where),
        );
        if (!order) {
          throw recordNotFoundError();
        }

        const updatedOrder: OrderRecord = {
          ...order,
          status: options.data.status ?? order.status,
          paymentStatus: options.data.paymentStatus ?? order.paymentStatus,
          confirmedAt: options.data.confirmedAt ?? order.confirmedAt,
          confirmedById:
            options.data.confirmedById === undefined
              ? order.confirmedById
              : options.data.confirmedById,
          paidAt: options.data.paidAt ?? order.paidAt,
          paidById:
            options.data.paidById === undefined
              ? order.paidById
              : options.data.paidById,
          fulfilledAt: options.data.fulfilledAt ?? order.fulfilledAt,
          fulfilledById:
            options.data.fulfilledById === undefined
              ? order.fulfilledById
              : options.data.fulfilledById,
          cancelledAt: options.data.cancelledAt ?? order.cancelledAt,
          cancelledById:
            options.data.cancelledById === undefined
              ? order.cancelledById
              : options.data.cancelledById,
          cancelReason:
            options.data.cancelReason === undefined
              ? order.cancelReason
              : options.data.cancelReason,
          updatedAt: new Date(),
        };
        orders.set(order.id, updatedOrder);
        return includeOrderRelations(updatedOrder, options.include);
      },
      async count(options?: { where?: OrderWhere }) {
        return [...orders.values()].filter((order) =>
          matchesOrderWhere(order, options?.where),
        ).length;
      },
      async deleteMany(options?: { where?: OrderWhere }) {
        const matchingIds = [...orders.values()]
          .filter((order) => matchesOrderWhere(order, options?.where))
          .map((order) => order.id);
        for (const id of matchingIds) {
          orders.delete(id);
          for (const item of orderItems.values()) {
            if (item.orderId === id) {
              orderItems.delete(item.id);
            }
          }
        }
        return { count: matchingIds.length };
      },
    },
    async $queryRaw(strings?: TemplateStringsArray) {
      const query = Array.isArray(strings) ? strings.join("") : "";
      if (query.includes("OrderReferenceSequence")) {
        const value = BigInt(orderReferenceSequence);
        orderReferenceSequence += 1;
        return [{ value }];
      }

      const value = BigInt(saleReferenceSequence);
      saleReferenceSequence += 1;
      return [{ value }];
    },
    async $transaction<T>(callback: (tx: DatabaseClient) => Promise<T>) {
      const userSnapshot = new Map(users);
      const refreshTokenSnapshot = new Map(refreshTokens);
      const productSnapshot = new Map(products);
      const stockMovementSnapshot = new Map(stockMovements);
      const saleSnapshot = new Map(sales);
      const saleItemSnapshot = new Map(saleItems);
      const orderSnapshot = new Map(orders);
      const orderItemSnapshot = new Map(orderItems);
      try {
        return await callback(db as unknown as DatabaseClient);
      } catch (error) {
        users.clear();
        refreshTokens.clear();
        products.clear();
        stockMovements.clear();
        sales.clear();
        saleItems.clear();
        orders.clear();
        orderItems.clear();
        for (const [id, user] of userSnapshot) users.set(id, user);
        for (const [id, token] of refreshTokenSnapshot) {
          refreshTokens.set(id, token);
        }
        for (const [id, product] of productSnapshot) products.set(id, product);
        for (const [id, movement] of stockMovementSnapshot) {
          stockMovements.set(id, movement);
        }
        for (const [id, sale] of saleSnapshot) sales.set(id, sale);
        for (const [id, item] of saleItemSnapshot) saleItems.set(id, item);
        for (const [id, order] of orderSnapshot) orders.set(id, order);
        for (const [id, item] of orderItemSnapshot) orderItems.set(id, item);
        throw error;
      }
    },
  };

  return {
    db: db as unknown as DatabaseClient,
    users,
    refreshTokens,
    products,
    stockMovements,
    sales,
    saleItems,
    orders,
    orderItems,
  };
}
