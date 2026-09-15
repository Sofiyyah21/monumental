import jwt from "jsonwebtoken";
import request from "supertest";
import { describe, expect, it } from "vitest";
import {
  ProductCategory,
  ProductUnit,
  StockMovementType,
  UserRole,
} from "@prisma/client";
import { createApp } from "../app.js";
import type { DatabaseClient } from "../lib/database.js";
import { createFakeDatabase } from "./fake-db.js";

let userSequence = 1;
let productSequence = 1;

function createInventoryTestContext() {
  const fake = createFakeDatabase();
  const app = createApp(fake.db);
  return { ...fake, app };
}

async function createAuth(db: DatabaseClient, role: UserRole) {
  const userNumber = userSequence;
  userSequence += 1;
  const user = await db.user.create({
    data: {
      email: `${role.toLowerCase()}-${userNumber}@inventory.test`,
      name: `${role} Inventory`,
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
    category?: ProductCategory;
    unit?: ProductUnit;
    reorderLevel?: number;
  } = {},
) {
  const sequence = productSequence;
  productSequence += 1;

  return db.product.create({
    data: {
      name: input.name ?? `Inventory Product ${sequence}`,
      sku: `INV-${sequence}`,
      category: input.category ?? ProductCategory.DRINKS,
      unit: input.unit ?? ProductUnit.PACK,
      costPrice: 100,
      sellingPrice: 150,
      reorderLevel: input.reorderLevel ?? 5,
    },
  });
}

describe("inventory API", () => {
  it("receives stock and creates an auditable movement", async () => {
    const { app, db, stockMovements } = createInventoryTestContext();
    const product = await createProduct(db);
    const { auth, user } = await createAuth(db, UserRole.ADMIN);

    const response = await request(app)
      .post("/api/v1/inventory/receive")
      .set("Authorization", auth)
      .send({
        productId: product.id,
        quantity: 12,
        unit: ProductUnit.PACK,
        unitCost: 95,
        reference: "PO-001",
        note: "Initial receiving",
      })
      .expect(201);

    expect(Number(response.body.data.product.currentStock)).toBe(12);
    expect(response.body.data.movement).toMatchObject({
      productId: product.id,
      type: StockMovementType.RECEIVED,
      reference: "PO-001",
      note: "Initial receiving",
      createdById: user.id,
    });
    expect(Number(response.body.data.movement.previousStock)).toBe(0);
    expect(Number(response.body.data.movement.newStock)).toBe(12);
    expect(stockMovements.size).toBe(1);
  });

  it("rejects invalid receipt quantities and mismatched units without partial updates", async () => {
    const { app, db, stockMovements } = createInventoryTestContext();
    const product = await createProduct(db);
    const { auth } = await createAuth(db, UserRole.MANAGER);

    await request(app)
      .post("/api/v1/inventory/receive")
      .set("Authorization", auth)
      .send({ productId: product.id, quantity: 0, unit: ProductUnit.PACK })
      .expect(400);

    await request(app)
      .post("/api/v1/inventory/receive")
      .set("Authorization", auth)
      .send({ productId: product.id, quantity: 5, unit: ProductUnit.CUP })
      .expect(400);

    const storedProduct = await db.product.findUniqueOrThrow({
      where: { id: product.id },
    });
    expect(Number(storedProduct.currentStock)).toBe(0);
    expect(stockMovements.size).toBe(0);
  });

  it("enforces stock receiving authorization by permission", async () => {
    const { app, db } = createInventoryTestContext();
    const product = await createProduct(db);
    const staff = await createAuth(db, UserRole.STAFF);
    const customer = await createAuth(db, UserRole.CUSTOMER);
    const manager = await createAuth(db, UserRole.MANAGER);
    const admin = await createAuth(db, UserRole.ADMIN);

    await request(app)
      .post("/api/v1/inventory/receive")
      .set("Authorization", staff.auth)
      .send({ productId: product.id, quantity: 1, unit: ProductUnit.PACK })
      .expect(403);
    await request(app)
      .post("/api/v1/inventory/receive")
      .set("Authorization", customer.auth)
      .send({ productId: product.id, quantity: 1, unit: ProductUnit.PACK })
      .expect(403);
    await request(app)
      .post("/api/v1/inventory/receive")
      .set("Authorization", manager.auth)
      .send({ productId: product.id, quantity: 1, unit: ProductUnit.PACK })
      .expect(201);
    await request(app)
      .post("/api/v1/inventory/receive")
      .set("Authorization", admin.auth)
      .send({ productId: product.id, quantity: 1, unit: ProductUnit.PACK })
      .expect(201);
  });

  it("records positive and negative adjustments with required reasons", async () => {
    const { app, db } = createInventoryTestContext();
    const product = await createProduct(db);
    const { auth } = await createAuth(db, UserRole.MANAGER);

    await request(app)
      .post("/api/v1/inventory/receive")
      .set("Authorization", auth)
      .send({ productId: product.id, quantity: 10, unit: ProductUnit.PACK })
      .expect(201);

    const positiveAdjustment = await request(app)
      .post("/api/v1/inventory/adjust")
      .set("Authorization", auth)
      .send({
        productId: product.id,
        quantityChange: 3,
        unit: ProductUnit.PACK,
        reason: "Count correction",
      })
      .expect(201);
    expect(Number(positiveAdjustment.body.data.product.currentStock)).toBe(13);
    expect(positiveAdjustment.body.data.movement.type).toBe(
      StockMovementType.ADJUSTMENT,
    );

    const negativeAdjustment = await request(app)
      .post("/api/v1/inventory/adjust")
      .set("Authorization", auth)
      .send({
        productId: product.id,
        quantityChange: -4,
        unit: ProductUnit.PACK,
        reason: "Missing during count",
      })
      .expect(201);
    expect(Number(negativeAdjustment.body.data.product.currentStock)).toBe(9);

    await request(app)
      .post("/api/v1/inventory/adjust")
      .set("Authorization", auth)
      .send({
        productId: product.id,
        quantityChange: 0,
        unit: ProductUnit.PACK,
        reason: "No change",
      })
      .expect(400);
    await request(app)
      .post("/api/v1/inventory/adjust")
      .set("Authorization", auth)
      .send({
        productId: product.id,
        quantityChange: 1,
        unit: ProductUnit.PACK,
      })
      .expect(400);
    await request(app)
      .post("/api/v1/inventory/adjust")
      .set("Authorization", auth)
      .send({
        productId: product.id,
        quantityChange: -100,
        unit: ProductUnit.PACK,
        reason: "Impossible correction",
      })
      .expect(409);
  });

  it("enforces adjustment authorization", async () => {
    const { app, db } = createInventoryTestContext();
    const product = await createProduct(db);
    const staff = await createAuth(db, UserRole.STAFF);

    await request(app)
      .post("/api/v1/inventory/adjust")
      .set("Authorization", staff.auth)
      .send({
        productId: product.id,
        quantityChange: 1,
        unit: ProductUnit.PACK,
        reason: "Count correction",
      })
      .expect(403);
  });

  it("records returns and keeps stock balance consistent", async () => {
    const { app, db } = createInventoryTestContext();
    const product = await createProduct(db);
    const { auth } = await createAuth(db, UserRole.MANAGER);
    const customer = await createAuth(db, UserRole.CUSTOMER);

    const response = await request(app)
      .post("/api/v1/inventory/returns")
      .set("Authorization", auth)
      .send({
        productId: product.id,
        quantity: 2,
        unit: ProductUnit.PACK,
        reference: "RET-001",
        note: "Returned to stock",
      })
      .expect(201);

    expect(response.body.data.movement.type).toBe(StockMovementType.RETURN);
    expect(Number(response.body.data.product.currentStock)).toBe(2);

    await request(app)
      .post("/api/v1/inventory/returns")
      .set("Authorization", auth)
      .send({ productId: product.id, quantity: -1, unit: ProductUnit.PACK })
      .expect(400);
    await request(app)
      .post("/api/v1/inventory/returns")
      .set("Authorization", customer.auth)
      .send({ productId: product.id, quantity: 1, unit: ProductUnit.PACK })
      .expect(403);
  });

  it("records damaged stock as a subtracting movement", async () => {
    const { app, db } = createInventoryTestContext();
    const product = await createProduct(db);
    const { auth } = await createAuth(db, UserRole.ADMIN);

    await request(app)
      .post("/api/v1/inventory/receive")
      .set("Authorization", auth)
      .send({ productId: product.id, quantity: 5, unit: ProductUnit.PACK })
      .expect(201);

    const response = await request(app)
      .post("/api/v1/inventory/damage")
      .set("Authorization", auth)
      .send({
        productId: product.id,
        quantity: 2,
        unit: ProductUnit.PACK,
        reason: "Damaged during handling",
      })
      .expect(201);

    expect(response.body.data.movement.type).toBe(StockMovementType.DAMAGE);
    expect(Number(response.body.data.product.currentStock)).toBe(3);
  });

  it("returns current stock, inventory listing, and low-stock products", async () => {
    const { app, db } = createInventoryTestContext();
    const lowProduct = await createProduct(db, {
      name: "Low Drink",
      reorderLevel: 5,
    });
    const stockedProduct = await createProduct(db, {
      name: "Stocked Drink",
      reorderLevel: 5,
    });
    const manager = await createAuth(db, UserRole.MANAGER);
    const staff = await createAuth(db, UserRole.STAFF);

    await request(app)
      .post("/api/v1/inventory/receive")
      .set("Authorization", manager.auth)
      .send({
        productId: stockedProduct.id,
        quantity: 10,
        unit: ProductUnit.PACK,
      })
      .expect(201);

    const currentStock = await request(app)
      .get(`/api/v1/inventory/products/${stockedProduct.id}`)
      .set("Authorization", staff.auth)
      .expect(200);
    expect(Number(currentStock.body.data.currentStock)).toBe(10);
    expect(currentStock.body.data.lowStock).toBe(false);

    const listResponse = await request(app)
      .get("/api/v1/inventory")
      .set("Authorization", staff.auth)
      .expect(200);
    expect(listResponse.body.data).toHaveLength(2);

    const lowStockResponse = await request(app)
      .get("/api/v1/inventory/low-stock")
      .set("Authorization", staff.auth)
      .expect(200);
    expect(lowStockResponse.body.data).toHaveLength(1);
    expect(lowStockResponse.body.data[0].productId).toBe(lowProduct.id);
  });

  it("lists and filters stock movement history", async () => {
    const { app, db } = createInventoryTestContext();
    const product = await createProduct(db);
    const otherProduct = await createProduct(db);
    const { auth } = await createAuth(db, UserRole.MANAGER);

    await request(app)
      .post("/api/v1/inventory/receive")
      .set("Authorization", auth)
      .send({ productId: product.id, quantity: 5, unit: ProductUnit.PACK })
      .expect(201);
    await request(app)
      .post("/api/v1/inventory/returns")
      .set("Authorization", auth)
      .send({ productId: otherProduct.id, quantity: 1, unit: ProductUnit.PACK })
      .expect(201);

    const response = await request(app)
      .get("/api/v1/inventory/movements")
      .query({
        productId: product.id,
        type: StockMovementType.RECEIVED,
        from: new Date(Date.now() - 60_000).toISOString(),
        to: new Date(Date.now() + 60_000).toISOString(),
      })
      .set("Authorization", auth)
      .expect(200);

    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0]).toMatchObject({
      productId: product.id,
      type: StockMovementType.RECEIVED,
    });

    await request(app)
      .get("/api/v1/inventory/movements")
      .query({ type: "UNKNOWN" })
      .set("Authorization", auth)
      .expect(400);
    await request(app)
      .get("/api/v1/inventory/movements")
      .query({
        from: new Date(Date.now() + 60_000).toISOString(),
        to: new Date(Date.now() - 60_000).toISOString(),
      })
      .set("Authorization", auth)
      .expect(400);
  });

  it("keeps historical movements available when a product is inactive", async () => {
    const { app, db } = createInventoryTestContext();
    const product = await createProduct(db);
    const { auth } = await createAuth(db, UserRole.ADMIN);

    await request(app)
      .post("/api/v1/inventory/receive")
      .set("Authorization", auth)
      .send({ productId: product.id, quantity: 4, unit: ProductUnit.PACK })
      .expect(201);
    await db.product.update({
      where: { id: product.id },
      data: { active: false },
    });

    const response = await request(app)
      .get("/api/v1/inventory/movements")
      .query({ productId: product.id })
      .set("Authorization", auth)
      .expect(200);

    expect(response.body.data).toHaveLength(1);
  });
});
