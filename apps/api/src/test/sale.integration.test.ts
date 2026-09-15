import crypto from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  PaymentMethod,
  PaymentStatus,
  Prisma,
  ProductCategory,
  ProductUnit,
  StockMovementType,
  UserRole,
} from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { InventoryService } from "../services/inventory.service.js";
import { SaleService } from "../services/sale.service.js";

const runDatabaseTests = process.env.RUN_DATABASE_TESTS === "true";
const describeDatabase = runDatabaseTests ? describe : describe.skip;
const testSkuPrefix = "SALE-INTEGRATION";
const testEmailDomain = "sale-integration.test";

function assertSafeTestDatabase() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required for sale integration tests.");
  }

  const databaseName = new URL(databaseUrl).pathname.replace("/", "");
  if (!databaseName.toLowerCase().includes("test")) {
    throw new Error(
      "Sale integration tests require a dedicated test database name containing 'test'.",
    );
  }
}

function uniqueSku(prefix: string) {
  return `${testSkuPrefix}-${prefix}-${crypto.randomUUID()}`.toUpperCase();
}

async function cleanupIntegrationSales() {
  await prisma.stockMovement.deleteMany({
    where: {
      OR: [
        { product: { sku: { startsWith: testSkuPrefix } } },
        { createdBy: { email: { endsWith: `@${testEmailDomain}` } } },
      ],
    },
  });
  await prisma.sale.deleteMany({
    where: { seller: { email: { endsWith: `@${testEmailDomain}` } } },
  });
  await prisma.product.deleteMany({
    where: { sku: { startsWith: testSkuPrefix } },
  });
  await prisma.user.deleteMany({
    where: { email: { endsWith: `@${testEmailDomain}` } },
  });
}

async function createUser(role = UserRole.STAFF) {
  return prisma.user.create({
    data: {
      email: `sale-${crypto.randomUUID()}@${testEmailDomain}`,
      name: "Sale Integration User",
      passwordHash: "hashed",
      role,
    },
  });
}

async function createProduct(input: {
  stock: number;
  costPrice?: number;
  sellingPrice?: number;
  name?: string;
}) {
  return prisma.product.create({
    data: {
      name: input.name ?? `Sale Integration Product ${crypto.randomUUID()}`,
      sku: uniqueSku("PRODUCT"),
      category: ProductCategory.DRINKS,
      unit: ProductUnit.PACK,
      costPrice: new Prisma.Decimal(input.costPrice ?? 100),
      sellingPrice: new Prisma.Decimal(input.sellingPrice ?? 150),
      currentStock: new Prisma.Decimal(input.stock),
      reorderLevel: new Prisma.Decimal(2),
    },
  });
}

describeDatabase("database-backed sales integration", () => {
  const saleService = new SaleService(prisma);
  const inventoryService = new InventoryService(prisma);

  beforeAll(async () => {
    assertSafeTestDatabase();
    await prisma.$connect();
    await cleanupIntegrationSales();
  });

  afterAll(async () => {
    await cleanupIntegrationSales();
    await prisma.$disconnect();
  });

  it("creates a sale, snapshots product data, decrements stock, and records SOLD movement", async () => {
    const seller = await createUser();
    const product = await createProduct({
      name: "Snapshot Integration Drink",
      stock: 10,
      costPrice: 80,
      sellingPrice: 125,
    });

    const sale = await saleService.create({
      sellerId: seller.id,
      paymentMethod: PaymentMethod.CASH,
      paymentStatus: PaymentStatus.PAID,
      discountAmount: 25,
      items: [{ productId: product.id, quantity: 2 }],
    });

    expect(sale.reference).toMatch(/^MD-\d{8}-\d{5}$/);
    expect(sale.subtotal.toNumber()).toBe(250);
    expect(sale.discountAmount.toNumber()).toBe(25);
    expect(sale.totalAmount.toNumber()).toBe(225);
    expect(sale.totalCost.toNumber()).toBe(160);
    expect(sale.grossProfit.toNumber()).toBe(65);
    expect(sale.items[0]).toMatchObject({
      productId: product.id,
      productName: "Snapshot Integration Drink",
      productUnit: ProductUnit.PACK,
    });
    expect(sale.items[0]?.unitPrice.toNumber()).toBe(125);
    expect(sale.items[0]?.unitCost.toNumber()).toBe(80);

    await prisma.product.update({
      where: { id: product.id },
      data: { name: "Renamed Integration Drink", sellingPrice: 200 },
    });

    const storedSale = await saleService.getById(sale.id);
    expect(storedSale.items[0]?.productName).toBe("Snapshot Integration Drink");
    expect(storedSale.items[0]?.unitPrice.toNumber()).toBe(125);

    const storedProduct = await prisma.product.findUniqueOrThrow({
      where: { id: product.id },
    });
    expect(storedProduct.currentStock.toNumber()).toBe(8);

    const movement = await prisma.stockMovement.findFirstOrThrow({
      where: { saleId: sale.id, type: StockMovementType.SOLD },
    });
    expect(movement.reference).toBe(sale.reference);
    expect(movement.previousStock.toNumber()).toBe(10);
    expect(movement.newStock.toNumber()).toBe(8);
  });

  it("rolls back sale data, sale items, stock, and movements when a sale fails", async () => {
    const seller = await createUser();
    const product = await createProduct({ stock: 1 });

    await expect(
      saleService.create({
        sellerId: seller.id,
        paymentMethod: PaymentMethod.CASH,
        paymentStatus: PaymentStatus.PAID,
        discountAmount: 0,
        items: [{ productId: product.id, quantity: 2 }],
      }),
    ).rejects.toMatchObject({ statusCode: 409, code: "INSUFFICIENT_STOCK" });

    const storedProduct = await prisma.product.findUniqueOrThrow({
      where: { id: product.id },
    });
    const saleCount = await prisma.sale.count({
      where: { sellerId: seller.id },
    });
    const movementCount = await prisma.stockMovement.count({
      where: { productId: product.id },
    });

    expect(storedProduct.currentStock.toNumber()).toBe(1);
    expect(saleCount).toBe(0);
    expect(movementCount).toBe(0);
  });

  it("prevents concurrent sales from overselling stock", async () => {
    const seller = await createUser();
    const product = await createProduct({ stock: 10 });

    const results = await Promise.allSettled([
      saleService.create({
        sellerId: seller.id,
        paymentMethod: PaymentMethod.CASH,
        paymentStatus: PaymentStatus.PAID,
        discountAmount: 0,
        items: [{ productId: product.id, quantity: 7 }],
      }),
      saleService.create({
        sellerId: seller.id,
        paymentMethod: PaymentMethod.CASH,
        paymentStatus: PaymentStatus.PAID,
        discountAmount: 0,
        items: [{ productId: product.id, quantity: 6 }],
      }),
    ]);

    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      results.filter((result) => result.status === "rejected"),
    ).toHaveLength(1);

    const storedProduct = await prisma.product.findUniqueOrThrow({
      where: { id: product.id },
    });
    const movements = await prisma.stockMovement.findMany({
      where: { productId: product.id, type: StockMovementType.SOLD },
    });
    const saleCount = await prisma.sale.count({
      where: { sellerId: seller.id },
    });

    expect([3, 4]).toContain(storedProduct.currentStock.toNumber());
    expect(movements).toHaveLength(1);
    expect(saleCount).toBe(1);
  });

  it("generates unique display-safe sale references", async () => {
    const seller = await createUser();
    const product = await createProduct({ stock: 5 });

    await inventoryService.receiveStock({
      productId: product.id,
      quantity: 1,
      unit: ProductUnit.PACK,
      userId: seller.id,
    });

    const firstSale = await saleService.create({
      sellerId: seller.id,
      paymentMethod: PaymentMethod.TRANSFER,
      paymentStatus: PaymentStatus.PAID,
      discountAmount: 0,
      items: [{ productId: product.id, quantity: 1 }],
    });
    const secondSale = await saleService.create({
      sellerId: seller.id,
      paymentMethod: PaymentMethod.CARD,
      paymentStatus: PaymentStatus.PAID,
      discountAmount: 0,
      items: [{ productId: product.id, quantity: 1 }],
    });

    expect(firstSale.reference).not.toBe(secondSale.reference);
    expect(firstSale.reference).toMatch(/^MD-\d{8}-\d{5}$/);
    expect(secondSale.reference).toMatch(/^MD-\d{8}-\d{5}$/);
  });
});
