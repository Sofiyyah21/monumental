import {
  PaymentMethod,
  PaymentStatus,
  Prisma,
  SaleStatus,
  StockMovementType,
  UserRole,
} from "@prisma/client";
import { AppError } from "../lib/app-error.js";
import type { DatabaseClient } from "../lib/database.js";
import {
  applyTrackedStockDelta,
  inventoryTransactionOptions,
} from "./inventory.service.js";
import { calculateSaleFinancials } from "./sales-calculations.js";

type CreateSaleItemInput = {
  productId: string;
  quantity: number;
};

export type CreateSaleInput = {
  sellerId: string;
  customerId?: string;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  paymentReference?: string;
  discountAmount: number;
  soldAt?: Date;
  items: CreateSaleItemInput[];
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
      include: {
        seller: { select: { id: true, name: true, email: true, role: true } },
        customer: { select: { id: true, name: true, email: true, role: true } },
        items: true,
      },
      orderBy: { soldAt: "desc" },
      take: input.limit ?? 25,
    });
  }

  async getById(id: string) {
    const sale = await this.db.sale.findUnique({
      where: { id },
      include: {
        seller: { select: { id: true, name: true, email: true, role: true } },
        customer: { select: { id: true, name: true, email: true, role: true } },
        items: true,
      },
    });

    if (!sale) {
      throw new AppError("Sale not found", 404, "SALE_NOT_FOUND");
    }

    return sale;
  }

  async create(input: CreateSaleInput) {
    return this.db.$transaction(async (tx) => {
      const soldAt = input.soldAt ?? new Date();
      if (input.customerId) {
        const customer = await tx.user.findUnique({
          where: { id: input.customerId },
        });
        if (
          !customer ||
          !customer.active ||
          customer.role !== UserRole.CUSTOMER
        ) {
          throw new AppError("Customer not found", 404, "CUSTOMER_NOT_FOUND");
        }
      }

      const requestedItems = this.mergeDuplicateItems(input.items);
      const productIds = [
        ...new Set(requestedItems.map((item) => item.productId)),
      ];
      const sortedProductIds = [...productIds].sort();
      await tx.$queryRaw`
          SELECT "id" FROM "Product"
          WHERE "id" IN (${Prisma.join(sortedProductIds)})
          ORDER BY "id"
          FOR UPDATE
        `;

      const products = await tx.product.findMany({
        where: { id: { in: productIds }, active: true },
      });

      if (products.length !== productIds.length) {
        throw new AppError(
          "One or more products were not found",
          404,
          "PRODUCT_NOT_FOUND",
        );
      }

      const saleItems = requestedItems.map((item) => {
        const product = products.find(
          (candidate) => candidate.id === item.productId,
        );
        if (!product) {
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

        const unitPrice = new Prisma.Decimal(product.sellingPrice);
        const unitCost = new Prisma.Decimal(product.costPrice);
        const lineTotal = quantity.mul(unitPrice).toDecimalPlaces(2);
        const lineCost = quantity.mul(unitCost).toDecimalPlaces(2);
        const grossProfit = lineTotal.minus(lineCost).toDecimalPlaces(2);

        return {
          product,
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

      const reference = await this.generateSaleReference(tx, soldAt);

      const sale = await tx.sale.create({
        data: {
          reference,
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
              productName: item.product.name,
              productUnit: item.product.unit,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              unitCost: item.unitCost,
              lineTotal: item.lineTotal,
              lineCost: item.lineCost,
              grossProfit: item.grossProfit,
            })),
          },
        },
        include: {
          seller: {
            select: { id: true, name: true, email: true, role: true },
          },
          customer: {
            select: { id: true, name: true, email: true, role: true },
          },
          items: true,
        },
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
    }, inventoryTransactionOptions);
  }

  private mergeDuplicateItems(items: CreateSaleItemInput[]) {
    const merged = new Map<string, CreateSaleItemInput>();
    for (const item of items) {
      const existing = merged.get(item.productId);
      if (!existing) {
        merged.set(item.productId, { ...item });
        continue;
      }
      existing.quantity += item.quantity;
    }
    return [...merged.values()];
  }

  private async generateSaleReference(
    tx: Prisma.TransactionClient,
    soldAt: Date,
  ) {
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
}
