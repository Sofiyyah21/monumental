import { Prisma, StockMovementType } from "@prisma/client";
import type { ProductUnit } from "@prisma/client";
import { AppError } from "../lib/app-error.js";
import type { DatabaseClient, TransactionClient } from "../lib/database.js";
import { isLowStock } from "./inventory-rules.js";

type DbClient = DatabaseClient | TransactionClient;
type StockChangeType =
  | typeof StockMovementType.RECEIVED
  | typeof StockMovementType.SOLD
  | typeof StockMovementType.RETURN
  | typeof StockMovementType.ADJUSTMENT
  | typeof StockMovementType.DAMAGE;

export type StockMovementFilters = {
  productId?: string;
  type?: StockMovementType;
  from?: Date;
  to?: Date;
  limit?: number;
};

export const inventoryTransactionOptions = {
  isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
};

export type TrackedStockDeltaInput = {
  productId: string;
  quantityChange: number | Prisma.Decimal;
  movementQuantity: number | Prisma.Decimal;
  unit: ProductUnit;
  type: StockChangeType;
  unitCost?: number | Prisma.Decimal;
  reference?: string;
  note?: string;
  saleId?: string;
  occurredAt?: Date;
  userId: string;
};

export class InventoryService {
  constructor(private readonly db: DatabaseClient) {}

  async receiveStock(input: {
    productId: string;
    quantity: number;
    unit: ProductUnit;
    unitCost?: number;
    reference?: string;
    note?: string;
    userId: string;
  }) {
    return this.db.$transaction(
      (tx) =>
        applyTrackedStockDelta(tx, {
          productId: input.productId,
          quantityChange: input.quantity,
          movementQuantity: input.quantity,
          unit: input.unit,
          type: StockMovementType.RECEIVED,
          unitCost: input.unitCost,
          reference: input.reference,
          note: input.note,
          userId: input.userId,
        }),
      inventoryTransactionOptions,
    );
  }

  async returnStock(input: {
    productId: string;
    quantity: number;
    unit: ProductUnit;
    reference?: string;
    note?: string;
    userId: string;
  }) {
    return this.db.$transaction(
      (tx) =>
        applyTrackedStockDelta(tx, {
          productId: input.productId,
          quantityChange: input.quantity,
          movementQuantity: input.quantity,
          unit: input.unit,
          type: StockMovementType.RETURN,
          reference: input.reference,
          note: input.note,
          userId: input.userId,
        }),
      inventoryTransactionOptions,
    );
  }

  async adjustStock(input: {
    productId: string;
    quantityChange: number;
    unit: ProductUnit;
    reason: string;
    reference?: string;
    userId: string;
  }) {
    return this.db.$transaction(
      (tx) =>
        applyTrackedStockDelta(tx, {
          productId: input.productId,
          quantityChange: input.quantityChange,
          movementQuantity: Math.abs(input.quantityChange),
          unit: input.unit,
          type: StockMovementType.ADJUSTMENT,
          reference: input.reference,
          note: input.reason,
          userId: input.userId,
        }),
      inventoryTransactionOptions,
    );
  }

  async recordDamage(input: {
    productId: string;
    quantity: number;
    unit: ProductUnit;
    reason: string;
    reference?: string;
    userId: string;
  }) {
    return this.db.$transaction(
      (tx) =>
        applyTrackedStockDelta(tx, {
          productId: input.productId,
          quantityChange: -input.quantity,
          movementQuantity: input.quantity,
          unit: input.unit,
          type: StockMovementType.DAMAGE,
          reference: input.reference,
          note: input.reason,
          userId: input.userId,
        }),
      inventoryTransactionOptions,
    );
  }

  async getCurrentStock(productId: string) {
    const product = await this.db.product.findUnique({
      where: { id: productId },
    });
    if (!product) {
      throw new AppError("Product not found", 404, "PRODUCT_NOT_FOUND");
    }

    return {
      productId: product.id,
      name: product.name,
      sku: product.sku,
      category: product.category,
      unit: product.unit,
      currentStock: product.currentStock,
      reorderLevel: product.reorderLevel,
      lowStock: isLowStock(product),
      active: product.active,
    };
  }

  async listInventory(input: { active?: boolean; lowStock?: boolean } = {}) {
    const products = await this.db.product.findMany({
      where: { active: input.active ?? true },
      orderBy: [{ category: "asc" }, { name: "asc" }],
    });

    return products
      .map((product) => ({
        productId: product.id,
        name: product.name,
        sku: product.sku,
        category: product.category,
        unit: product.unit,
        currentStock: product.currentStock,
        reorderLevel: product.reorderLevel,
        lowStock: isLowStock(product),
        active: product.active,
      }))
      .filter((product) =>
        input.lowStock === undefined
          ? true
          : product.lowStock === input.lowStock,
      );
  }

  async listLowStockProducts() {
    return this.listInventory({ active: true, lowStock: true });
  }

  async listMovements(input: StockMovementFilters = {}) {
    return this.db.stockMovement.findMany({
      where: {
        productId: input.productId,
        type: input.type,
        occurredAt:
          input.from || input.to
            ? {
                gte: input.from,
                lte: input.to,
              }
            : undefined,
      },
      include: {
        product: true,
        createdBy: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
      orderBy: { occurredAt: "desc" },
      take: input.limit ?? 50,
    });
  }
}

export async function applyTrackedStockDelta(
  tx: DbClient,
  input: TrackedStockDeltaInput,
) {
  const movementQuantity = new Prisma.Decimal(
    input.movementQuantity.toString(),
  );
  assertPositiveMovementQuantity(movementQuantity);
  const product = await findActiveProductForUpdate(tx, input.productId);
  assertUnitMatchesProduct(product.unit, input.unit);

  const previousStock = new Prisma.Decimal(product.currentStock);
  const quantityChange = new Prisma.Decimal(input.quantityChange.toString());
  const newStock = previousStock.plus(quantityChange);

  if (newStock.lt(0)) {
    throw new AppError(
      "Inventory cannot become negative",
      409,
      "NEGATIVE_STOCK_NOT_ALLOWED",
    );
  }

  const unitCost =
    input.unitCost === undefined
      ? undefined
      : new Prisma.Decimal(input.unitCost.toString());

  const updatedProduct = await tx.product.update({
    where: { id: input.productId },
    data: {
      currentStock: newStock,
      costPrice:
        input.type === StockMovementType.RECEIVED ? unitCost : undefined,
    },
  });

  const movement = await tx.stockMovement.create({
    data: {
      productId: input.productId,
      type: input.type,
      quantity: movementQuantity,
      previousStock,
      newStock,
      unitCost,
      reference: input.reference,
      note: input.note,
      saleId: input.saleId,
      createdById: input.userId,
      occurredAt: input.occurredAt,
    },
  });

  return { product: updatedProduct, movement };
}

async function findActiveProductForUpdate(tx: DbClient, productId: string) {
  await tx.$queryRaw`
    SELECT "id" FROM "Product" WHERE "id" = ${productId} FOR UPDATE
  `;

  const product = await tx.product.findUnique({ where: { id: productId } });
  if (!product || !product.active) {
    throw new AppError("Product not found", 404, "PRODUCT_NOT_FOUND");
  }
  return product;
}

function assertPositiveMovementQuantity(quantity: Prisma.Decimal) {
  if (quantity.lte(0)) {
    throw new AppError(
      "Movement quantity must be positive",
      400,
      "INVALID_STOCK_QUANTITY",
    );
  }
}

function assertUnitMatchesProduct(
  expectedUnit: ProductUnit,
  unit: ProductUnit,
) {
  if (expectedUnit !== unit) {
    throw new AppError(
      `Product stock is tracked in ${expectedUnit}`,
      400,
      "INVALID_STOCK_UNIT",
    );
  }
}
