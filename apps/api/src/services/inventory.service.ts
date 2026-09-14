import { Prisma, StockMovementType } from "@prisma/client";
import { AppError } from "../lib/app-error.js";
import type { DatabaseClient, TransactionClient } from "../lib/database.js";

type DbClient = DatabaseClient | TransactionClient;

export class InventoryService {
  constructor(private readonly db: DatabaseClient) {}

  async receiveStock(input: {
    productId: string;
    quantity: number;
    unitCost?: number;
    note?: string;
    userId: string;
  }) {
    return this.db.$transaction((tx) =>
      this.applyStockChange(tx, {
        productId: input.productId,
        quantity: input.quantity,
        type: StockMovementType.RECEIVED,
        unitCost: input.unitCost,
        note: input.note,
        userId: input.userId,
      }),
    );
  }

  async returnStock(input: {
    productId: string;
    quantity: number;
    note?: string;
    userId: string;
  }) {
    return this.db.$transaction((tx) =>
      this.applyStockChange(tx, {
        productId: input.productId,
        quantity: input.quantity,
        type: StockMovementType.RETURN,
        note: input.note,
        userId: input.userId,
      }),
    );
  }

  async adjustStock(input: {
    productId: string;
    newStock: number;
    note: string;
    userId: string;
  }) {
    return this.db.$transaction(async (tx) => {
      const product = await this.findActiveProduct(tx, input.productId);
      const previousStock = new Prisma.Decimal(product.currentStock);
      const newStock = new Prisma.Decimal(input.newStock.toString());
      const quantity = previousStock.minus(newStock).abs();

      const updatedProduct = await tx.product.update({
        where: { id: input.productId },
        data: { currentStock: newStock },
      });

      const movement = await tx.stockMovement.create({
        data: {
          productId: input.productId,
          type: StockMovementType.ADJUSTMENT,
          quantity,
          previousStock,
          newStock,
          note: input.note,
          createdById: input.userId,
        },
      });

      return { product: updatedProduct, movement };
    });
  }

  async listMovements(limit = 50) {
    return this.db.stockMovement.findMany({
      include: {
        product: true,
        createdBy: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
      orderBy: { occurredAt: "desc" },
      take: limit,
    });
  }

  private async applyStockChange(
    tx: DbClient,
    input: {
      productId: string;
      quantity: number;
      type: "RECEIVED" | "RETURN";
      unitCost?: number;
      note?: string;
      userId: string;
    },
  ) {
    const product = await this.findActiveProduct(tx, input.productId);
    const quantity = new Prisma.Decimal(input.quantity.toString());
    const previousStock = new Prisma.Decimal(product.currentStock);
    const newStock = previousStock.plus(quantity);

    const updatedProduct = await tx.product.update({
      where: { id: input.productId },
      data: {
        currentStock: newStock,
        costPrice:
          input.unitCost === undefined
            ? undefined
            : new Prisma.Decimal(input.unitCost.toString()),
      },
    });

    const movement = await tx.stockMovement.create({
      data: {
        productId: input.productId,
        type: input.type,
        quantity,
        previousStock,
        newStock,
        unitCost:
          input.unitCost === undefined
            ? undefined
            : new Prisma.Decimal(input.unitCost.toString()),
        note: input.note,
        createdById: input.userId,
      },
    });

    return { product: updatedProduct, movement };
  }

  private async findActiveProduct(tx: DbClient, productId: string) {
    const product = await tx.product.findUnique({ where: { id: productId } });
    if (!product || !product.active) {
      throw new AppError("Product not found", 404, "PRODUCT_NOT_FOUND");
    }
    return product;
  }
}
