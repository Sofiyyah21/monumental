import jwt from "jsonwebtoken";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  PaymentMethod,
  PaymentStatus,
  Prisma,
  ProductCategory,
  ProductUnit,
  SaleStatus,
  UserRole,
} from "@prisma/client";
import { createApp } from "../app.js";
import type { DatabaseClient } from "../lib/database.js";
import { SaleService } from "../services/sale.service.js";
import { createFakeDatabase } from "./fake-db.js";

let userSequence = 1;
let productSequence = 1;

function createReportTestContext() {
  const fake = createFakeDatabase();
  const app = createApp(fake.db);
  const saleService = new SaleService(fake.db);
  return { ...fake, app, saleService };
}

async function createAuth(db: DatabaseClient, role: UserRole) {
  const userNumber = userSequence;
  userSequence += 1;
  const user = await db.user.create({
    data: {
      email: `${role.toLowerCase()}-${userNumber}@reports.test`,
      name: `${role} Reports`,
      passwordHash: "hashed",
      role,
    },
  });
  const accessToken = jwt.sign(
    { email: user.email, role },
    process.env.JWT_ACCESS_SECRET!,
    {
      subject: user.id,
      expiresIn: "15m",
    },
  );

  return { user, auth: `Bearer ${accessToken}` };
}

async function createProduct(
  db: DatabaseClient,
  input: {
    name: string;
    sku?: string;
    category?: ProductCategory;
    unit?: ProductUnit;
    stock: number;
    reorderLevel?: number;
    costPrice: number;
    sellingPrice: number;
  },
) {
  const sequence = productSequence;
  productSequence += 1;
  const product = await db.product.create({
    data: {
      name: input.name,
      sku: input.sku ?? `REPORT-${sequence}`,
      category: input.category ?? ProductCategory.DRINKS,
      unit: input.unit ?? ProductUnit.PACK,
      costPrice: input.costPrice,
      sellingPrice: input.sellingPrice,
      reorderLevel: input.reorderLevel ?? 2,
    },
  });

  return db.product.update({
    where: { id: product.id },
    data: { currentStock: new Prisma.Decimal(input.stock) },
  });
}

describe("reports API", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-15T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns today's sales summary using persisted sale totals", async () => {
    const { app, db, saleService } = createReportTestContext();
    const admin = await createAuth(db, UserRole.ADMIN);
    const product = await createProduct(db, {
      name: "Report Drink",
      stock: 20,
      costPrice: 100,
      sellingPrice: 150,
    });

    await saleService.create({
      sellerId: admin.user.id,
      paymentMethod: PaymentMethod.CASH,
      paymentStatus: PaymentStatus.PAID,
      discountAmount: 50,
      soldAt: new Date("2026-09-15T10:00:00.000Z"),
      items: [{ productId: product.id, quantity: 3 }],
    });

    const response = await request(app)
      .get("/api/v1/reports/today")
      .set("Authorization", admin.auth)
      .expect(200);

    expect(response.body.data.salesCount).toBe(1);
    expect(Number(response.body.data.unitsSold)).toBe(3);
    expect(Number(response.body.data.revenue)).toBe(400);
    expect(Number(response.body.data.cogs)).toBe(300);
    expect(Number(response.body.data.grossProfit)).toBe(100);
    expect(Number(response.body.data.discounts)).toBe(50);
    expect(Number(response.body.data.averageSaleValue)).toBe(400);
  });

  it("uses Lagos boundaries for week, month, year, and custom ranges", async () => {
    const { app, db, saleService } = createReportTestContext();
    const manager = await createAuth(db, UserRole.MANAGER);
    const product = await createProduct(db, {
      name: "Boundary Drink",
      stock: 20,
      costPrice: 10,
      sellingPrice: 20,
    });

    await saleService.create({
      sellerId: manager.user.id,
      paymentMethod: PaymentMethod.CASH,
      paymentStatus: PaymentStatus.PAID,
      discountAmount: 0,
      soldAt: new Date("2026-09-13T22:59:59.000Z"),
      items: [{ productId: product.id, quantity: 1 }],
    });
    await saleService.create({
      sellerId: manager.user.id,
      paymentMethod: PaymentMethod.CASH,
      paymentStatus: PaymentStatus.PAID,
      discountAmount: 0,
      soldAt: new Date("2026-09-13T23:00:00.000Z"),
      items: [{ productId: product.id, quantity: 2 }],
    });
    await saleService.create({
      sellerId: manager.user.id,
      paymentMethod: PaymentMethod.CASH,
      paymentStatus: PaymentStatus.PAID,
      discountAmount: 0,
      soldAt: new Date("2026-09-14T23:00:00.000Z"),
      items: [{ productId: product.id, quantity: 3 }],
    });

    const week = await request(app)
      .get("/api/v1/reports/week")
      .set("Authorization", manager.auth)
      .expect(200);
    const month = await request(app)
      .get("/api/v1/reports/month")
      .set("Authorization", manager.auth)
      .expect(200);
    const year = await request(app)
      .get("/api/v1/reports/year")
      .set("Authorization", manager.auth)
      .expect(200);
    const custom = await request(app)
      .get("/api/v1/reports/sales?from=2026-09-14&to=2026-09-14")
      .set("Authorization", manager.auth)
      .expect(200);

    expect(Number(week.body.data.unitsSold)).toBe(5);
    expect(Number(month.body.data.unitsSold)).toBe(6);
    expect(Number(year.body.data.unitsSold)).toBe(6);
    expect(Number(custom.body.data.unitsSold)).toBe(2);
  });

  it("reports product sales and best sellers from sale item snapshots", async () => {
    const { app, db, saleService } = createReportTestContext();
    const admin = await createAuth(db, UserRole.ADMIN);
    const drink = await createProduct(db, {
      name: "Snapshot Cola",
      stock: 20,
      costPrice: 80,
      sellingPrice: 120,
    });
    const noodles = await createProduct(db, {
      name: "Snapshot Noodles",
      category: ProductCategory.NOODLES,
      unit: ProductUnit.PACK,
      stock: 20,
      costPrice: 50,
      sellingPrice: 75,
    });

    await saleService.create({
      sellerId: admin.user.id,
      paymentMethod: PaymentMethod.CASH,
      paymentStatus: PaymentStatus.PAID,
      discountAmount: 0,
      soldAt: new Date("2026-09-15T09:00:00.000Z"),
      items: [
        { productId: drink.id, quantity: 2 },
        { productId: noodles.id, quantity: 5 },
      ],
    });
    await db.product.update({
      where: { id: noodles.id },
      data: { name: "Renamed Noodles", sellingPrice: 200 },
    });

    const products = await request(app)
      .get("/api/v1/reports/products?from=2026-09-15&to=2026-09-15")
      .set("Authorization", admin.auth)
      .expect(200);
    const bestSellers = await request(app)
      .get("/api/v1/reports/best-sellers?from=2026-09-15&to=2026-09-15")
      .set("Authorization", admin.auth)
      .expect(200);

    expect(products.body.data.products).toHaveLength(2);
    const noodlesRow = products.body.data.products.find(
      (product: { productId: string }) => product.productId === noodles.id,
    );
    expect(noodlesRow.productName).toBe("Snapshot Noodles");
    expect(Number(noodlesRow.quantitySold)).toBe(5);
    expect(Number(noodlesRow.revenue)).toBe(375);
    expect(Number(noodlesRow.cogs)).toBe(250);
    expect(Number(noodlesRow.grossProfit)).toBe(125);

    expect(bestSellers.body.data.rankingMetric).toBe("quantitySold");
    expect(bestSellers.body.data.products[0]).toMatchObject({
      rank: 1,
      productId: noodles.id,
      productName: "Snapshot Noodles",
    });
  });

  it("rejects invalid report filters", async () => {
    vi.useRealTimers();
    const { app, db } = createReportTestContext();
    const admin = await createAuth(db, UserRole.ADMIN);

    await request(app)
      .get("/api/v1/reports/sales?from=2026-09-31&to=2026-09-15")
      .set("Authorization", admin.auth)
      .expect(400);

    await request(app)
      .get("/api/v1/reports/sales?from=2026-09-16&to=2026-09-15")
      .set("Authorization", admin.auth)
      .expect(400);
  });

  it("reports low-stock and inventory summaries without mixing units", async () => {
    const { app, db } = createReportTestContext();
    const manager = await createAuth(db, UserRole.MANAGER);
    await createProduct(db, {
      name: "Normal Drink",
      stock: 10,
      reorderLevel: 2,
      costPrice: 10,
      sellingPrice: 20,
    });
    await createProduct(db, {
      name: "Low Sugar",
      category: ProductCategory.SUGAR,
      unit: ProductUnit.CUP,
      stock: 2,
      reorderLevel: 2,
      costPrice: 5,
      sellingPrice: 8,
    });
    await createProduct(db, {
      name: "Out Oil",
      category: ProductCategory.VEGETABLE_OIL,
      unit: ProductUnit.LITER,
      stock: 0,
      reorderLevel: 1,
      costPrice: 100,
      sellingPrice: 120,
    });

    const lowStock = await request(app)
      .get("/api/v1/reports/low-stock")
      .set("Authorization", manager.auth)
      .expect(200);
    const inventory = await request(app)
      .get("/api/v1/reports/inventory")
      .set("Authorization", manager.auth)
      .expect(200);

    expect(
      lowStock.body.data.map(
        (product: { stockStatus: string }) => product.stockStatus,
      ),
    ).toEqual(["OUT_OF_STOCK", "LOW_STOCK"]);
    expect(inventory.body.data).toMatchObject({
      totalActiveProducts: 3,
      lowStockProductCount: 1,
      outOfStockProductCount: 1,
    });
    expect(inventory.body.data.stockByUnit).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ unit: ProductUnit.PACK }),
        expect.objectContaining({ unit: ProductUnit.CUP }),
        expect.objectContaining({ unit: ProductUnit.LITER }),
      ]),
    );
  });

  it("excludes cancelled sales from financial reporting", async () => {
    const { app, db } = createReportTestContext();
    const admin = await createAuth(db, UserRole.ADMIN);
    const product = await createProduct(db, {
      name: "Cancelled Drink",
      stock: 10,
      costPrice: 10,
      sellingPrice: 20,
    });

    await db.sale.create({
      data: {
        reference: "VOIDED-REPORT-1",
        sellerId: admin.user.id,
        status: SaleStatus.VOIDED,
        paymentMethod: PaymentMethod.CASH,
        paymentStatus: PaymentStatus.PAID,
        subtotal: new Prisma.Decimal(100),
        discountAmount: new Prisma.Decimal(0),
        totalAmount: new Prisma.Decimal(100),
        totalCost: new Prisma.Decimal(50),
        grossProfit: new Prisma.Decimal(50),
        soldAt: new Date("2026-09-15T10:00:00.000Z"),
        items: {
          create: [
            {
              productId: product.id,
              productName: product.name,
              productUnit: product.unit,
              quantity: new Prisma.Decimal(5),
              unitPrice: new Prisma.Decimal(20),
              unitCost: new Prisma.Decimal(10),
              lineTotal: new Prisma.Decimal(100),
              lineCost: new Prisma.Decimal(50),
              grossProfit: new Prisma.Decimal(50),
            },
          ],
        },
      },
    });

    const response = await request(app)
      .get("/api/v1/reports/today")
      .set("Authorization", admin.auth)
      .expect(200);

    expect(response.body.data.salesCount).toBe(0);
    expect(Number(response.body.data.revenue)).toBe(0);
    expect(Number(response.body.data.cogs)).toBe(0);
    expect(Number(response.body.data.grossProfit)).toBe(0);
  });

  it("excludes voided sales from summaries, product sales, and best sellers", async () => {
    const { app, db, saleService } = createReportTestContext();
    const admin = await createAuth(db, UserRole.ADMIN);
    const manager = await createAuth(db, UserRole.MANAGER);
    const product = await createProduct(db, {
      name: "Voided Report Drink",
      stock: 20,
      costPrice: 10,
      sellingPrice: 20,
    });

    const sale = await saleService.create({
      sellerId: admin.user.id,
      paymentMethod: PaymentMethod.CASH,
      paymentStatus: PaymentStatus.PAID,
      discountAmount: 0,
      soldAt: new Date("2026-09-15T10:00:00.000Z"),
      items: [{ productId: product.id, quantity: 5 }],
    });

    await saleService.voidSale({
      saleId: sale.id,
      voidedById: manager.user.id,
      reason: "Reporting exclusion test",
    });

    const summary = await request(app)
      .get("/api/v1/reports/today")
      .set("Authorization", admin.auth)
      .expect(200);
    const products = await request(app)
      .get("/api/v1/reports/products?from=2026-09-15&to=2026-09-15")
      .set("Authorization", admin.auth)
      .expect(200);
    const bestSellers = await request(app)
      .get("/api/v1/reports/best-sellers?from=2026-09-15&to=2026-09-15")
      .set("Authorization", admin.auth)
      .expect(200);

    expect(summary.body.data.salesCount).toBe(0);
    expect(Number(summary.body.data.unitsSold)).toBe(0);
    expect(Number(summary.body.data.revenue)).toBe(0);
    expect(Number(summary.body.data.cogs)).toBe(0);
    expect(Number(summary.body.data.grossProfit)).toBe(0);
    expect(products.body.data.products).toEqual([]);
    expect(bestSellers.body.data.products).toEqual([]);
  });

  it("enforces reporting RBAC", async () => {
    vi.useRealTimers();
    const { app, db } = createReportTestContext();
    const admin = await createAuth(db, UserRole.ADMIN);
    const manager = await createAuth(db, UserRole.MANAGER);
    const staff = await createAuth(db, UserRole.STAFF);
    const customer = await createAuth(db, UserRole.CUSTOMER);

    await request(app)
      .get("/api/v1/reports/today")
      .set("Authorization", admin.auth)
      .expect(200);
    await request(app)
      .get("/api/v1/reports/today")
      .set("Authorization", manager.auth)
      .expect(200);
    await request(app)
      .get("/api/v1/reports/today")
      .set("Authorization", staff.auth)
      .expect(403);
    await request(app)
      .get("/api/v1/reports/today")
      .set("Authorization", customer.auth)
      .expect(403);
    await request(app).get("/api/v1/reports/today").expect(401);
  });
});
