import crypto from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  PaymentMethod,
  PaymentStatus,
  Prisma,
  ProductCategory,
  ProductUnit,
  SaleStatus,
  UserRole,
} from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { ReportService } from "../services/report.service.js";
import { SaleService } from "../services/sale.service.js";

const runDatabaseTests = process.env.RUN_DATABASE_TESTS === "true";
const describeDatabase = runDatabaseTests ? describe : describe.skip;
const testSkuPrefix = "REPORT-INTEGRATION";
const testEmailDomain = "report-integration.test";

function assertSafeTestDatabase() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required for report integration tests.");
  }

  const databaseName = new URL(databaseUrl).pathname.replace("/", "");
  if (!databaseName.toLowerCase().includes("test")) {
    throw new Error(
      "Report integration tests require a dedicated test database name containing 'test'.",
    );
  }
}

function uniqueSku(prefix: string) {
  return `${testSkuPrefix}-${prefix}-${crypto.randomUUID()}`.toUpperCase();
}

async function cleanupIntegrationReports() {
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

async function createUser(role = UserRole.MANAGER) {
  return prisma.user.create({
    data: {
      email: `report-${crypto.randomUUID()}@${testEmailDomain}`,
      name: "Report Integration User",
      passwordHash: "hashed",
      role,
    },
  });
}

async function createProduct(input: {
  name: string;
  stock: number;
  costPrice: number;
  sellingPrice: number;
  category?: ProductCategory;
  unit?: ProductUnit;
  reorderLevel?: number;
}) {
  return prisma.product.create({
    data: {
      name: input.name,
      sku: uniqueSku("PRODUCT"),
      category: input.category ?? ProductCategory.DRINKS,
      unit: input.unit ?? ProductUnit.PACK,
      costPrice: new Prisma.Decimal(input.costPrice),
      sellingPrice: new Prisma.Decimal(input.sellingPrice),
      currentStock: new Prisma.Decimal(input.stock),
      reorderLevel: new Prisma.Decimal(input.reorderLevel ?? 2),
    },
  });
}

describeDatabase("database-backed reporting integration", () => {
  const saleService = new SaleService(prisma);
  const reportService = new ReportService(prisma);
  const now = new Date("2026-09-15T12:00:00.000Z");

  beforeAll(async () => {
    assertSafeTestDatabase();
    await prisma.$connect();
    await cleanupIntegrationReports();
  });

  beforeEach(async () => {
    await cleanupIntegrationReports();
  });

  afterAll(async () => {
    await cleanupIntegrationReports();
    await prisma.$disconnect();
  });

  it("aggregates summary totals and Lagos date boundaries from real sales data", async () => {
    const seller = await createUser();
    const product = await createProduct({
      name: "Boundary Integration Drink",
      stock: 30,
      costPrice: 100,
      sellingPrice: 150,
    });

    await saleService.create({
      sellerId: seller.id,
      paymentMethod: PaymentMethod.CASH,
      paymentStatus: PaymentStatus.PAID,
      discountAmount: 0,
      soldAt: new Date("2026-09-13T22:59:59.000Z"),
      items: [{ productId: product.id, quantity: 1 }],
    });
    await saleService.create({
      sellerId: seller.id,
      paymentMethod: PaymentMethod.CASH,
      paymentStatus: PaymentStatus.PAID,
      discountAmount: 25,
      soldAt: new Date("2026-09-13T23:00:00.000Z"),
      items: [{ productId: product.id, quantity: 2 }],
    });

    const week = await reportService.getPeriodSummary("week", {}, now);

    expect(week.salesCount).toBe(1);
    expect(week.unitsSold.toNumber()).toBe(2);
    expect(week.revenue.toNumber()).toBe(275);
    expect(week.cogs.toNumber()).toBe(200);
    expect(week.grossProfit.toNumber()).toBe(75);
    expect(week.discounts.toNumber()).toBe(25);
  });

  it("uses sale item snapshots for product reports after product price changes", async () => {
    const seller = await createUser();
    const product = await createProduct({
      name: "Snapshot Integration Sugar",
      category: ProductCategory.SUGAR,
      unit: ProductUnit.CUP,
      stock: 20,
      costPrice: 10,
      sellingPrice: 15,
    });

    await saleService.create({
      sellerId: seller.id,
      paymentMethod: PaymentMethod.TRANSFER,
      paymentStatus: PaymentStatus.PAID,
      discountAmount: 0,
      soldAt: new Date("2026-09-15T08:00:00.000Z"),
      items: [{ productId: product.id, quantity: 4 }],
    });
    await prisma.product.update({
      where: { id: product.id },
      data: { name: "Renamed Integration Sugar", sellingPrice: 30 },
    });

    const report = await reportService.getProductSales(
      { from: "2026-09-15", to: "2026-09-15" },
      now,
    );

    expect(report.products).toHaveLength(1);
    expect(report.products[0]).toMatchObject({
      productId: product.id,
      productName: "Snapshot Integration Sugar",
      unit: ProductUnit.CUP,
    });
    expect(report.products[0]?.quantitySold.toNumber()).toBe(4);
    expect(report.products[0]?.revenue.toNumber()).toBe(60);
    expect(report.products[0]?.cogs.toNumber()).toBe(40);
    expect(report.products[0]?.grossProfit.toNumber()).toBe(20);
  });

  it("excludes voided sales from financial reports", async () => {
    const seller = await createUser();
    const product = await createProduct({
      name: "Voided Integration Drink",
      stock: 10,
      costPrice: 20,
      sellingPrice: 30,
    });

    await prisma.sale.create({
      data: {
        reference: `VOIDED-${crypto.randomUUID()}`,
        sellerId: seller.id,
        status: SaleStatus.VOIDED,
        paymentMethod: PaymentMethod.CASH,
        paymentStatus: PaymentStatus.PAID,
        subtotal: new Prisma.Decimal(90),
        discountAmount: new Prisma.Decimal(0),
        totalAmount: new Prisma.Decimal(90),
        totalCost: new Prisma.Decimal(60),
        grossProfit: new Prisma.Decimal(30),
        soldAt: new Date("2026-09-15T08:00:00.000Z"),
        items: {
          create: [
            {
              productId: product.id,
              productName: product.name,
              productUnit: product.unit,
              quantity: new Prisma.Decimal(3),
              unitPrice: new Prisma.Decimal(30),
              unitCost: new Prisma.Decimal(20),
              lineTotal: new Prisma.Decimal(90),
              lineCost: new Prisma.Decimal(60),
              grossProfit: new Prisma.Decimal(30),
            },
          ],
        },
      },
    });

    const summary = await reportService.getPeriodSummary("today", {}, now);

    expect(summary.salesCount).toBe(0);
    expect(summary.revenue.toNumber()).toBe(0);
    expect(summary.cogs.toNumber()).toBe(0);
    expect(summary.grossProfit.toNumber()).toBe(0);
  });

  it("reports inventory stock statuses consistently with current stock", async () => {
    await createProduct({
      name: "Integration Normal Stock",
      stock: 10,
      reorderLevel: 2,
      costPrice: 10,
      sellingPrice: 15,
    });
    await createProduct({
      name: "Integration Low Stock",
      stock: 1,
      reorderLevel: 2,
      costPrice: 10,
      sellingPrice: 15,
    });
    await createProduct({
      name: "Integration Out Stock",
      category: ProductCategory.VEGETABLE_OIL,
      unit: ProductUnit.LITER,
      stock: 0,
      reorderLevel: 1,
      costPrice: 100,
      sellingPrice: 150,
    });

    const lowStock = await reportService.getLowStockReport();
    const inventory = await reportService.getInventorySummary();

    expect(lowStock.map((product) => product.stockStatus)).toEqual(
      expect.arrayContaining(["LOW_STOCK", "OUT_OF_STOCK"]),
    );
    expect(inventory.lowStockProductCount).toBeGreaterThanOrEqual(1);
    expect(inventory.outOfStockProductCount).toBeGreaterThanOrEqual(1);
    expect(inventory.stockByUnit.length).toBeGreaterThanOrEqual(2);
  });
});
