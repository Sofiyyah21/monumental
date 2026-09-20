import {
  PaymentMethod,
  PaymentStatus,
  Prisma,
  ProductUnit,
  SaleStatus,
  StockMovementType,
  UserRole,
} from "@prisma/client";
import { AppError } from "../lib/app-error.js";
import type { DatabaseClient, TransactionClient } from "../lib/database.js";
import {
  applyTrackedStockDelta,
  inventoryTransactionOptions,
} from "./inventory.service.js";
import { calculateSaleFinancials } from "./sales-calculations.js";

type CreateSaleItemInput = {
  productId: string;
  quantity: number;
};

export type CreateSaleSnapshotItemInput = {
  productId: string;
  quantity: number | Prisma.Decimal;
  unitPrice?: number | Prisma.Decimal;
  productName?: string;
  productUnit?: ProductUnit;
};

export type CreateSaleInput = {
  sellerId: string;
  customerId?: string;
  orderId?: string;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  paymentReference?: string;
  discountAmount: number;
  soldAt?: Date;
  items: CreateSaleItemInput[];
};

export type CreateSaleInTransactionInput = Omit<CreateSaleInput, "items"> & {
  items: CreateSaleSnapshotItemInput[];
  requireActiveProducts?: boolean;
};

export type ListSalesInput = {
  sellerId?: string;
  customerId?: string;
  status?: SaleStatus;
  paymentStatus?: PaymentStatus;
  from?: Date;
  to?: Date;
  limit?: number;
};

export type VoidSaleInput = {
  saleId: string;
  voidedById: string;
  reason: string;
};

const saleInclude = {
  seller: { select: { id: true, name: true, email: true, role: true } },
  customer: { select: { id: true, name: true, email: true, role: true } },
  voidedBy: { select: { id: true, name: true, email: true, role: true } },
  items: true,
} satisfies Prisma.SaleInclude;

export class SaleService {
  constructor(private readonly db: DatabaseClient) {}

  async list(input: ListSalesInput = {}) {
    return this.db.sale.findMany({
      where: {
        sellerId: input.sellerId,
        customerId: input.customerId,
        status: input.status,
        paymentStatus: input.paymentStatus,
        soldAt:
          input.from || input.to
            ? {
                gte: input.from,
                lte: input.to,
              }
            : undefined,
      },
      include: saleInclude,
      orderBy: { soldAt: "desc" },
      take: input.limit ?? 25,
    });
  }

  async getById(id: string) {
    const sale = await this.db.sale.findUnique({
      where: { id },
      include: saleInclude,
    });

    if (!sale) {
      throw new AppError("Sale not found", 404, "SALE_NOT_FOUND");
    }

    return sale;
  }

  async create(input: CreateSaleInput) {
    return this.db.$transaction(async (tx) => {
      return createSaleInTransaction(tx, input);
    }, inventoryTransactionOptions);
  }

  async voidSale(input: VoidSaleInput) {
    return this.db.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT "id" FROM "Sale" WHERE "id" = ${input.saleId} FOR UPDATE
      `;

      const sale = await tx.sale.findUnique({
        where: { id: input.saleId },
        include: saleInclude,
      });

      if (!sale) {
        throw new AppError("Sale not found", 404, "SALE_NOT_FOUND");
      }

      if (sale.status === SaleStatus.VOIDED) {
        throw new AppError(
          "Sale has already been voided",
          409,
          "SALE_ALREADY_VOIDED",
        );
      }

      if (sale.status !== SaleStatus.COMPLETED) {
        throw new AppError(
          "Sale cannot be voided from its current state",
          409,
          "SALE_NOT_VOIDABLE",
        );
      }

      const productIds = [...new Set(sale.items.map((item) => item.productId))];
      const sortedProductIds = [...productIds].sort();
      await tx.$queryRaw`
        SELECT "id" FROM "Product"
        WHERE "id" IN (${Prisma.join(sortedProductIds)})
        ORDER BY "id"
        FOR UPDATE
      `;

      const voidedAt = new Date();
      const reason = input.reason.trim();

      for (const item of [...sale.items].sort((a, b) =>
        a.productId.localeCompare(b.productId),
      )) {
        await applyTrackedStockDelta(tx, {
          productId: item.productId,
          quantityChange: item.quantity,
          movementQuantity: item.quantity,
          unit: item.productUnit,
          type: StockMovementType.RETURN,
          unitCost: item.unitCost,
          reference: sale.reference,
          saleId: sale.id,
          userId: input.voidedById,
          note: `Void sale: ${reason}`,
          occurredAt: voidedAt,
          requireActive: false,
          requireUnitMatch: false,
        });
      }

      return tx.sale.update({
        where: { id: sale.id },
        data: {
          status: SaleStatus.VOIDED,
          voidedAt,
          voidedById: input.voidedById,
          voidReason: reason,
        },
        include: saleInclude,
      });
    }, inventoryTransactionOptions);
  }
}

export async function createSaleInTransaction(
  tx: TransactionClient,
  input: CreateSaleInTransactionInput,
) {
  const soldAt = input.soldAt ?? new Date();
  if (input.customerId) {
    const customer = await tx.user.findUnique({
      where: { id: input.customerId },
    });
    if (!customer || !customer.active || customer.role !== UserRole.CUSTOMER) {
      throw new AppError("Customer not found", 404, "CUSTOMER_NOT_FOUND");
    }
  }

  const requestedItems = mergeDuplicateSaleItems(input.items);
  const productIds = [...new Set(requestedItems.map((item) => item.productId))];
  const sortedProductIds = [...productIds].sort();
  await tx.$queryRaw`
    SELECT "id" FROM "Product"
    WHERE "id" IN (${Prisma.join(sortedProductIds)})
    ORDER BY "id"
    FOR UPDATE
  `;

  const products = await tx.product.findMany({
    where: { id: { in: productIds } },
  });

  if (products.length !== productIds.length) {
    throw new AppError(
      "One or more products were not found",
      404,
      "PRODUCT_NOT_FOUND",
    );
  }

  const requireActiveProducts = input.requireActiveProducts ?? true;
  const saleItems = requestedItems.map((item) => {
    const product = products.find(
      (candidate) => candidate.id === item.productId,
    );
    if (!product || (requireActiveProducts && !product.active)) {
      throw new AppError(
        "One or more products were not found",
        404,
        "PRODUCT_NOT_FOUND",
      );
    }

    const quantity = new Prisma.Decimal(item.quantity.toString());
    const currentStock = new Prisma.Decimal(product.currentStock);
    if (currentStock.lt(quantity)) {
      throw new AppError(
        `Insufficient stock for ${product.name}`,
        409,
        "INSUFFICIENT_STOCK",
      );
    }

    const unitPrice =
      item.unitPrice === undefined
        ? new Prisma.Decimal(product.sellingPrice)
        : new Prisma.Decimal(item.unitPrice.toString());
    const unitCost = new Prisma.Decimal(product.costPrice);
    const lineTotal = quantity.mul(unitPrice).toDecimalPlaces(2);
    const lineCost = quantity.mul(unitCost).toDecimalPlaces(2);
    const grossProfit = lineTotal.minus(lineCost).toDecimalPlaces(2);

    return {
      product,
      productName: item.productName ?? product.name,
      productUnit: item.productUnit ?? product.unit,
      quantity,
      unitPrice,
      unitCost,
      lineTotal,
      lineCost,
      grossProfit,
    };
  });

  const totals = calculateSaleFinancials(
    saleItems.map((item) => ({
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      unitCost: item.unitCost,
    })),
    new Prisma.Decimal(input.discountAmount.toString()),
  );

  if (totals.discountAmount.gt(totals.subtotal)) {
    throw new AppError(
      "Discount cannot exceed sale subtotal",
      400,
      "INVALID_DISCOUNT",
    );
  }

  const reference = await generateSaleReference(tx, soldAt);

  const sale = await tx.sale.create({
    data: {
      reference,
      orderId: input.orderId,
      sellerId: input.sellerId,
      customerId: input.customerId,
      paymentMethod: input.paymentMethod,
      paymentStatus: input.paymentStatus,
      paymentReference: input.paymentReference,
      soldAt,
      status: SaleStatus.COMPLETED,
      subtotal: totals.subtotal,
      discountAmount: totals.discountAmount,
      totalAmount: totals.totalAmount,
      totalCost: totals.totalCost,
      grossProfit: totals.grossProfit,
      items: {
        create: saleItems.map((item) => ({
          productId: item.product.id,
          productName: item.productName,
          productUnit: item.productUnit,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          unitCost: item.unitCost,
          lineTotal: item.lineTotal,
          lineCost: item.lineCost,
          grossProfit: item.grossProfit,
        })),
      },
    },
    include: saleInclude,
  });

  for (const item of saleItems.sort((a, b) =>
    a.product.id.localeCompare(b.product.id),
  )) {
    try {
      await applyTrackedStockDelta(tx, {
        productId: item.product.id,
        quantityChange: item.quantity.neg(),
        movementQuantity: item.quantity,
        unit: item.product.unit,
        type: StockMovementType.SOLD,
        unitCost: item.unitCost,
        reference: sale.reference,
        saleId: sale.id,
        userId: input.sellerId,
        occurredAt: soldAt,
        requireActive: requireActiveProducts,
      });
    } catch (error) {
      if (
        error instanceof AppError &&
        error.code === "NEGATIVE_STOCK_NOT_ALLOWED"
      ) {
        throw new AppError(
          `Insufficient stock for ${item.product.name}`,
          409,
          "INSUFFICIENT_STOCK",
        );
      }
      throw error;
    }
  }

  return sale;
}

function mergeDuplicateSaleItems(items: CreateSaleSnapshotItemInput[]) {
  const merged = new Map<string, CreateSaleSnapshotItemInput>();
  for (const item of items) {
    const existing = merged.get(item.productId);
    if (!existing) {
      merged.set(item.productId, { ...item });
      continue;
    }
    existing.quantity = new Prisma.Decimal(existing.quantity.toString()).plus(
      new Prisma.Decimal(item.quantity.toString()),
    );
  }
  return [...merged.values()];
}

async function generateSaleReference(tx: TransactionClient, soldAt: Date) {
  const [sequenceValue] = await tx.$queryRaw<Array<{ value: bigint }>>`
    SELECT nextval('"SaleReferenceSequence"')::bigint AS value
  `;

  if (!sequenceValue) {
    throw new AppError(
      "Unable to generate sale reference",
      500,
      "SALE_REFERENCE_FAILED",
    );
  }

  const datePart = soldAt.toISOString().slice(0, 10).replaceAll("-", "");
  return `MD-${datePart}-${sequenceValue.value.toString().padStart(5, "0")}`;
}
