import {
  PaymentMethod,
  Prisma,
  SaleStatus,
  StockMovementType,
  UserRole,
} from "@prisma/client";
import { AppError } from "../lib/app-error.js";
import type { DatabaseClient } from "../lib/database.js";
import { calculateSaleTotals, roundMoney } from "./sales-calculations.js";

type CreateSaleItemInput = {
  productId: string;
  quantity: number;
  unitPrice?: number;
};

export type CreateSaleInput = {
  sellerId: string;
  customerId?: string;
  paymentMethod: PaymentMethod;
  paymentReference?: string;
  soldAt?: Date;
  items: CreateSaleItemInput[];
};

export class SaleService {
  constructor(private readonly db: DatabaseClient) {}

  async list(limit = 25) {
    return this.db.sale.findMany({
      include: {
        seller: { select: { id: true, name: true, email: true, role: true } },
        customer: { select: { id: true, name: true, email: true, role: true } },
        items: true,
      },
      orderBy: { soldAt: "desc" },
      take: limit,
    });
  }

  async create(input: CreateSaleInput) {
    return this.db.$transaction(
      async (tx) => {
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
        const productIds = requestedItems.map((item) => item.productId);
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

          const unitPrice = item.unitPrice ?? Number(product.sellingPrice);
          const unitCost = Number(product.costPrice);
          const lineTotal = roundMoney(item.quantity * unitPrice);
          const lineCost = roundMoney(item.quantity * unitCost);
          const grossProfit = roundMoney(lineTotal - lineCost);

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

        const totals = calculateSaleTotals(
          saleItems.map((item) => ({
            quantity: Number(item.quantity),
            unitPrice: item.unitPrice,
            unitCost: item.unitCost,
          })),
        );

        const sale = await tx.sale.create({
          data: {
            sellerId: input.sellerId,
            customerId: input.customerId,
            paymentMethod: input.paymentMethod,
            paymentReference: input.paymentReference,
            soldAt: input.soldAt,
            status: SaleStatus.COMPLETED,
            totalAmount: new Prisma.Decimal(totals.totalAmount),
            totalCost: new Prisma.Decimal(totals.totalCost),
            grossProfit: new Prisma.Decimal(totals.grossProfit),
            items: {
              create: saleItems.map((item) => ({
                productId: item.product.id,
                productName: item.product.name,
                productUnit: item.product.unit,
                quantity: item.quantity,
                unitPrice: new Prisma.Decimal(item.unitPrice),
                unitCost: new Prisma.Decimal(item.unitCost),
                lineTotal: new Prisma.Decimal(item.lineTotal),
                lineCost: new Prisma.Decimal(item.lineCost),
                grossProfit: new Prisma.Decimal(item.grossProfit),
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

        for (const item of saleItems) {
          const previousStock = new Prisma.Decimal(item.product.currentStock);
          const newStock = previousStock.minus(item.quantity);

          const updateResult = await tx.product.updateMany({
            where: {
              id: item.product.id,
              currentStock: { gte: item.quantity },
            },
            data: {
              currentStock: { decrement: item.quantity },
            },
          });

          if (updateResult.count !== 1) {
            throw new AppError(
              `Insufficient stock for ${item.product.name}`,
              409,
              "INSUFFICIENT_STOCK",
            );
          }

          await tx.stockMovement.create({
            data: {
              productId: item.product.id,
              type: StockMovementType.SOLD,
              quantity: item.quantity,
              previousStock,
              newStock,
              unitCost: new Prisma.Decimal(item.unitCost),
              saleId: sale.id,
              createdById: input.sellerId,
              occurredAt: sale.soldAt,
            },
          });
        }

        return sale;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  private mergeDuplicateItems(items: CreateSaleItemInput[]) {
    const merged = new Map<string, CreateSaleItemInput>();
    for (const item of items) {
      const existing = merged.get(item.productId);
      if (!existing) {
        merged.set(item.productId, { ...item });
        continue;
      }
      if (existing.unitPrice !== item.unitPrice) {
        throw new AppError(
          "Duplicate sale items must use the same unit price",
          400,
          "DUPLICATE_ITEM_PRICE_MISMATCH",
        );
      }
      existing.quantity += item.quantity;
    }
    return [...merged.values()];
  }
}
