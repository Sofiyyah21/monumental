import jwt from "jsonwebtoken";
import request from "supertest";
import { describe, expect, it } from "vitest";
import {
  PaymentMethod,
  PaymentStatus,
  Prisma,
  ProductCategory,
  ProductUnit,
  SaleStatus,
  StockMovementType,
  UserRole,
} from "@prisma/client";
import { createApp } from "../app.js";
import type { DatabaseClient } from "../lib/database.js";
import { createFakeDatabase } from "./fake-db.js";

let userSequence = 1;
let productSequence = 1;

function createSaleTestContext() {
  const fake = createFakeDatabase();
  const app = createApp(fake.db);
  return { ...fake, app };
}

async function createAuth(db: DatabaseClient, role: UserRole) {
  const userNumber = userSequence;
  userSequence += 1;
  const user = await db.user.create({
    data: {
      email: `${role.toLowerCase()}-${userNumber}@sales.test`,
      name: `${role} Sales`,
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
    name?: string;
    stock?: number;
    costPrice?: number;
    sellingPrice?: number;
    active?: boolean;
  } = {},
) {
  const sequence = productSequence;
  productSequence += 1;
  const product = await db.product.create({
    data: {
      name: input.name ?? `Sale Product ${sequence}`,
      sku: `SALE-${sequence}`,
      category: ProductCategory.DRINKS,
      unit: ProductUnit.PACK,
      costPrice: input.costPrice ?? 100,
      sellingPrice: input.sellingPrice ?? 150,
      reorderLevel: 2,
    },
  });

  return db.product.update({
    where: { id: product.id },
    data: {
      active: input.active ?? true,
      currentStock: new Prisma.Decimal(input.stock ?? 10),
    },
  });
}

function createSalePayload(
  items: Array<
    { productId: string; quantity: number } & Record<string, unknown>
  >,
  overrides: Record<string, unknown> = {},
) {
  return {
    paymentMethod: PaymentMethod.CASH,
    paymentStatus: PaymentStatus.PAID,
    items,
    ...overrides,
  };
}

describe("sales API", () => {
  it("creates a valid single-item sale with snapshots, financials, and SOLD movement", async () => {
    const { app, db, stockMovements } = createSaleTestContext();
    const product = await createProduct(db, {
      name: "Original Drink",
      stock: 10,
      costPrice: 80,
      sellingPrice: 125,
    });
    const staff = await createAuth(db, UserRole.STAFF);

    const response = await request(app)
      .post("/api/v1/sales")
      .set("Authorization", staff.auth)
      .send(
        createSalePayload([
          { productId: product.id, quantity: 3, unitPrice: 1 },
        ]),
      )
      .expect(201);

    expect(response.body.data.reference).toMatch(/^MD-\d{8}-\d{5}$/);
    expect(response.body.data.status).toBe(SaleStatus.COMPLETED);
    expect(response.body.data.paymentStatus).toBe(PaymentStatus.PAID);
    expect(Number(response.body.data.subtotal)).toBe(375);
    expect(Number(response.body.data.discountAmount)).toBe(0);
    expect(Number(response.body.data.totalAmount)).toBe(375);
    expect(Number(response.body.data.totalCost)).toBe(240);
    expect(Number(response.body.data.grossProfit)).toBe(135);

    const [item] = response.body.data.items;
    expect(item).toMatchObject({
      productId: product.id,
      productName: "Original Drink",
      productUnit: ProductUnit.PACK,
    });
    expect(Number(item.unitPrice)).toBe(125);
    expect(Number(item.unitCost)).toBe(80);
    expect(Number(item.lineTotal)).toBe(375);
    expect(Number(item.lineCost)).toBe(240);

    const storedProduct = await db.product.findUniqueOrThrow({
      where: { id: product.id },
    });
    expect(Number(storedProduct.currentStock)).toBe(7);

    const [movement] = [...stockMovements.values()];
    expect(movement).toMatchObject({
      productId: product.id,
      type: StockMovementType.SOLD,
      reference: response.body.data.reference,
      saleId: response.body.data.id,
      createdById: staff.user.id,
    });
    expect(Number(movement?.previousStock)).toBe(10);
    expect(Number(movement?.newStock)).toBe(7);
  });

  it("creates a valid multi-item sale with a sale-level discount", async () => {
    const { app, db } = createSaleTestContext();
    const drink = await createProduct(db, {
      name: "Drink Pack",
      stock: 10,
      costPrice: 100,
      sellingPrice: 150,
    });
    const noodles = await createProduct(db, {
      name: "Noodles Pack",
      stock: 10,
      costPrice: 50,
      sellingPrice: 75,
    });
    const manager = await createAuth(db, UserRole.MANAGER);

    const response = await request(app)
      .post("/api/v1/sales")
      .set("Authorization", manager.auth)
      .send(
        createSalePayload(
          [
            { productId: drink.id, quantity: 2 },
            { productId: noodles.id, quantity: 4 },
          ],
          { discountAmount: 50, paymentMethod: PaymentMethod.TRANSFER },
        ),
      )
      .expect(201);

    expect(Number(response.body.data.subtotal)).toBe(600);
    expect(Number(response.body.data.discountAmount)).toBe(50);
    expect(Number(response.body.data.totalAmount)).toBe(550);
    expect(Number(response.body.data.totalCost)).toBe(400);
    expect(Number(response.body.data.grossProfit)).toBe(150);
  });

  it("rejects invalid sale requests", async () => {
    const { app, db } = createSaleTestContext();
    const product = await createProduct(db);
    const staff = await createAuth(db, UserRole.STAFF);

    await request(app)
      .post("/api/v1/sales")
      .set("Authorization", staff.auth)
      .send(createSalePayload([]))
      .expect(400);
    await request(app)
      .post("/api/v1/sales")
      .set("Authorization", staff.auth)
      .send(createSalePayload([{ productId: product.id, quantity: 0 }]))
      .expect(400);
    await request(app)
      .post("/api/v1/sales")
      .set("Authorization", staff.auth)
      .send(createSalePayload([{ productId: product.id, quantity: -1 }]))
      .expect(400);
    await request(app)
      .post("/api/v1/sales")
      .set("Authorization", staff.auth)
      .send(
        createSalePayload([{ productId: product.id, quantity: 1 }], {
          discountAmount: -1,
        }),
      )
      .expect(400);
    await request(app)
      .post("/api/v1/sales")
      .set("Authorization", staff.auth)
      .send(
        createSalePayload([{ productId: product.id, quantity: 1 }], {
          paymentStatus: "FAILED",
        }),
      )
      .expect(400);
  });

  it("rejects nonexistent, inactive, insufficient-stock, and over-discounted sales", async () => {
    const { app, db, sales, saleItems, stockMovements } =
      createSaleTestContext();
    const activeProduct = await createProduct(db, { stock: 2 });
    const inactiveProduct = await createProduct(db, {
      stock: 5,
      active: false,
    });
    const staff = await createAuth(db, UserRole.STAFF);

    await request(app)
      .post("/api/v1/sales")
      .set("Authorization", staff.auth)
      .send(createSalePayload([{ productId: "missing", quantity: 1 }]))
      .expect(404);
    await request(app)
      .post("/api/v1/sales")
      .set("Authorization", staff.auth)
      .send(createSalePayload([{ productId: inactiveProduct.id, quantity: 1 }]))
      .expect(404);
    await request(app)
      .post("/api/v1/sales")
      .set("Authorization", staff.auth)
      .send(createSalePayload([{ productId: activeProduct.id, quantity: 3 }]))
      .expect(409);
    await request(app)
      .post("/api/v1/sales")
      .set("Authorization", staff.auth)
      .send(
        createSalePayload([{ productId: activeProduct.id, quantity: 1 }], {
          discountAmount: 1000,
        }),
      )
      .expect(400);

    const storedProduct = await db.product.findUniqueOrThrow({
      where: { id: activeProduct.id },
    });
    expect(Number(storedProduct.currentStock)).toBe(2);
    expect(sales.size).toBe(0);
    expect(saleItems.size).toBe(0);
    expect(stockMovements.size).toBe(0);
  });

  it("enforces sales authorization", async () => {
    const { app, db } = createSaleTestContext();
    const product = await createProduct(db);
    const customer = await createAuth(db, UserRole.CUSTOMER);
    const staff = await createAuth(db, UserRole.STAFF);
    const manager = await createAuth(db, UserRole.MANAGER);
    const admin = await createAuth(db, UserRole.ADMIN);
    const payload = createSalePayload([{ productId: product.id, quantity: 1 }]);

    await request(app)
      .post("/api/v1/sales")
      .set("Authorization", customer.auth)
      .send(payload)
      .expect(403);
    await request(app)
      .post("/api/v1/sales")
      .set("Authorization", staff.auth)
      .send(payload)
      .expect(201);
    await request(app)
      .post("/api/v1/sales")
      .set("Authorization", manager.auth)
      .send(payload)
      .expect(201);
    await request(app)
      .post("/api/v1/sales")
      .set("Authorization", admin.auth)
      .send(payload)
      .expect(201);
  });

  it("preserves sale item snapshots after product updates", async () => {
    const { app, db } = createSaleTestContext();
    const product = await createProduct(db, {
      name: "Snapshot Drink",
      stock: 5,
      costPrice: 60,
      sellingPrice: 100,
    });
    const admin = await createAuth(db, UserRole.ADMIN);

    const createResponse = await request(app)
      .post("/api/v1/sales")
      .set("Authorization", admin.auth)
      .send(createSalePayload([{ productId: product.id, quantity: 1 }]))
      .expect(201);

    await db.product.update({
      where: { id: product.id },
      data: { name: "Renamed Drink", costPrice: 80, sellingPrice: 140 },
    });

    const getResponse = await request(app)
      .get(`/api/v1/sales/${createResponse.body.data.id}`)
      .set("Authorization", admin.auth)
      .expect(200);

    expect(getResponse.body.data.items[0]).toMatchObject({
      productName: "Snapshot Drink",
      productUnit: ProductUnit.PACK,
    });
    expect(Number(getResponse.body.data.items[0].unitPrice)).toBe(100);
    expect(Number(getResponse.body.data.items[0].unitCost)).toBe(60);
  });

  it("lists, filters, and retrieves sales", async () => {
    const { app, db } = createSaleTestContext();
    const product = await createProduct(db, { stock: 5 });
    const customer = await createAuth(db, UserRole.CUSTOMER);
    const staff = await createAuth(db, UserRole.STAFF);
    const manager = await createAuth(db, UserRole.MANAGER);

    const createResponse = await request(app)
      .post("/api/v1/sales")
      .set("Authorization", staff.auth)
      .send(
        createSalePayload([{ productId: product.id, quantity: 1 }], {
          customerId: customer.user.id,
          paymentStatus: PaymentStatus.PENDING,
        }),
      )
      .expect(201);

    const listResponse = await request(app)
      .get("/api/v1/sales")
      .query({
        sellerId: staff.user.id,
        customerId: customer.user.id,
        status: SaleStatus.COMPLETED,
        paymentStatus: PaymentStatus.PENDING,
        from: new Date(Date.now() - 60_000).toISOString(),
        to: new Date(Date.now() + 60_000).toISOString(),
      })
      .set("Authorization", manager.auth)
      .expect(200);

    expect(listResponse.body.data).toHaveLength(1);
    expect(listResponse.body.data[0].id).toBe(createResponse.body.data.id);

    await request(app)
      .get(`/api/v1/sales/${createResponse.body.data.id}`)
      .set("Authorization", manager.auth)
      .expect(200);
    await request(app)
      .get("/api/v1/sales/missing")
      .set("Authorization", manager.auth)
      .expect(404);
    await request(app)
      .get("/api/v1/sales")
      .query({
        from: new Date(Date.now() + 60_000).toISOString(),
        to: new Date().toISOString(),
      })
      .set("Authorization", manager.auth)
      .expect(400);
  });

  it("rolls back sale, items, stock, and movements when a later item fails", async () => {
    const { app, db, sales, saleItems, stockMovements } =
      createSaleTestContext();
    const stockedProduct = await createProduct(db, { stock: 5 });
    const lowStockProduct = await createProduct(db, { stock: 1 });
    const staff = await createAuth(db, UserRole.STAFF);

    await request(app)
      .post("/api/v1/sales")
      .set("Authorization", staff.auth)
      .send(
        createSalePayload([
          { productId: stockedProduct.id, quantity: 2 },
          { productId: lowStockProduct.id, quantity: 2 },
        ]),
      )
      .expect(409);

    const storedProduct = await db.product.findUniqueOrThrow({
      where: { id: stockedProduct.id },
    });
    expect(Number(storedProduct.currentStock)).toBe(5);
    expect(sales.size).toBe(0);
    expect(saleItems.size).toBe(0);
    expect(stockMovements.size).toBe(0);
  });
});
