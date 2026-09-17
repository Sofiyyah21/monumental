import jwt from "jsonwebtoken";
import request from "supertest";
import { describe, expect, it } from "vitest";
import {
  OrderPaymentStatus,
  OrderStatus,
  Prisma,
  ProductCategory,
  ProductUnit,
  UserRole,
} from "@prisma/client";
import { createApp } from "../app.js";
import type { DatabaseClient } from "../lib/database.js";
import { createFakeDatabase } from "./fake-db.js";

let userSequence = 1;
let productSequence = 1;

function createOrderTestContext() {
  const fake = createFakeDatabase();
  const app = createApp(fake.db);
  return { ...fake, app };
}

async function createAuth(db: DatabaseClient, role: UserRole) {
  const userNumber = userSequence;
  userSequence += 1;
  const user = await db.user.create({
    data: {
      email: `${role.toLowerCase()}-${userNumber}@orders.test`,
      name: `${role} Orders`,
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
    category?: ProductCategory;
    unit?: ProductUnit;
  } = {},
) {
  const sequence = productSequence;
  productSequence += 1;
  const product = await db.product.create({
    data: {
      name: input.name ?? `Order Product ${sequence}`,
      sku: `ORDER-${sequence}`,
      category: input.category ?? ProductCategory.DRINKS,
      unit: input.unit ?? ProductUnit.PACK,
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

function createOrderPayload(
  items: Array<
    { productId: string; quantity: number } & Record<string, unknown>
  >,
  overrides: Record<string, unknown> = {},
) {
  return {
    items,
    ...overrides,
  };
}

describe("customer orders API", () => {
  it("requires authentication for create, list, and detail", async () => {
    const { app, db } = createOrderTestContext();
    const product = await createProduct(db);

    await request(app)
      .post("/api/v1/orders")
      .send(createOrderPayload([{ productId: product.id, quantity: 1 }]))
      .expect(401);
    await request(app).get("/api/v1/orders").expect(401);
    await request(app).get("/api/v1/orders/order_1").expect(401);
  });

  it("creates a customer order with server-calculated snapshots and leaves inventory unchanged", async () => {
    const { app, db, stockMovements } = createOrderTestContext();
    const product = await createProduct(db, {
      name: "Customer Sugar",
      stock: 8,
      sellingPrice: 125,
      category: ProductCategory.SUGAR,
      unit: ProductUnit.CUP,
    });
    const customer = await createAuth(db, UserRole.CUSTOMER);

    const response = await request(app)
      .post("/api/v1/orders")
      .set("Authorization", customer.auth)
      .send(
        createOrderPayload(
          [
            {
              productId: product.id,
              quantity: 3,
              unitPrice: 1,
              lineSubtotal: 1,
            },
          ],
          { subtotal: 1, customerId: "other-user", reference: "CUSTOM" },
        ),
      )
      .expect(201);

    expect(response.body.data.reference).toMatch(/^MD-ORD-\d{8}-\d{5}$/);
    expect(response.body.data).toMatchObject({
      status: OrderStatus.PENDING,
      paymentStatus: OrderPaymentStatus.UNPAID,
    });
    expect(Number(response.body.data.subtotal)).toBe(375);
    expect(response.body.data.customerId).toBeUndefined();
    expect(response.body.data.totalCost).toBeUndefined();
    expect(response.body.data.grossProfit).toBeUndefined();

    const [item] = response.body.data.items;
    expect(item).toMatchObject({
      productId: product.id,
      productName: "Customer Sugar",
      productSku: product.sku,
      productCategory: ProductCategory.SUGAR,
      productUnit: ProductUnit.CUP,
    });
    expect(Number(item.quantity)).toBe(3);
    expect(Number(item.unitPrice)).toBe(125);
    expect(Number(item.lineSubtotal)).toBe(375);
    expect(item.unitCost).toBeUndefined();
    expect(item.lineCost).toBeUndefined();

    const storedProduct = await db.product.findUniqueOrThrow({
      where: { id: product.id },
    });
    expect(Number(storedProduct.currentStock)).toBe(8);
    expect(stockMovements.size).toBe(0);
  });

  it("rejects invalid order payloads deterministically", async () => {
    const { app, db } = createOrderTestContext();
    const product = await createProduct(db);
    const customer = await createAuth(db, UserRole.CUSTOMER);

    await request(app)
      .post("/api/v1/orders")
      .set("Authorization", customer.auth)
      .send(createOrderPayload([]))
      .expect(400);
    await request(app)
      .post("/api/v1/orders")
      .set("Authorization", customer.auth)
      .send(createOrderPayload([{ productId: product.id, quantity: 0 }]))
      .expect(400);
    await request(app)
      .post("/api/v1/orders")
      .set("Authorization", customer.auth)
      .send(createOrderPayload([{ productId: product.id, quantity: -1 }]))
      .expect(400);
    await request(app)
      .post("/api/v1/orders")
      .set("Authorization", customer.auth)
      .send({ items: [{ productId: 12, quantity: 1 }] })
      .expect(400);
    await request(app)
      .post("/api/v1/orders")
      .set("Authorization", customer.auth)
      .send(createOrderPayload([{ productId: product.id, quantity: 1.5 }]))
      .expect(400);

    const duplicateResponse = await request(app)
      .post("/api/v1/orders")
      .set("Authorization", customer.auth)
      .send(
        createOrderPayload([
          { productId: product.id, quantity: 1 },
          { productId: product.id, quantity: 1 },
        ]),
      )
      .expect(400);
    expect(duplicateResponse.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("rejects missing, inactive, and unavailable products without partial persistence", async () => {
    const { app, db, orders, orderItems } = createOrderTestContext();
    const stockedProduct = await createProduct(db, { stock: 5 });
    const lowStockProduct = await createProduct(db, { stock: 1 });
    const inactiveProduct = await createProduct(db, {
      stock: 10,
      active: false,
    });
    const customer = await createAuth(db, UserRole.CUSTOMER);

    await request(app)
      .post("/api/v1/orders")
      .set("Authorization", customer.auth)
      .send(createOrderPayload([{ productId: "missing", quantity: 1 }]))
      .expect(404);
    await request(app)
      .post("/api/v1/orders")
      .set("Authorization", customer.auth)
      .send(
        createOrderPayload([{ productId: inactiveProduct.id, quantity: 1 }]),
      )
      .expect(409);
    await request(app)
      .post("/api/v1/orders")
      .set("Authorization", customer.auth)
      .send(
        createOrderPayload([{ productId: lowStockProduct.id, quantity: 2 }]),
      )
      .expect(409);
    await request(app)
      .post("/api/v1/orders")
      .set("Authorization", customer.auth)
      .send(
        createOrderPayload([
          { productId: stockedProduct.id, quantity: 1 },
          { productId: "missing-second-item", quantity: 1 },
        ]),
      )
      .expect(404);

    expect(orders.size).toBe(0);
    expect(orderItems.size).toBe(0);
  });

  it("enforces customer creation and management read authorization", async () => {
    const { app, db } = createOrderTestContext();
    const product = await createProduct(db, { stock: 10 });
    const customer = await createAuth(db, UserRole.CUSTOMER);
    const otherCustomer = await createAuth(db, UserRole.CUSTOMER);
    const staff = await createAuth(db, UserRole.STAFF);
    const manager = await createAuth(db, UserRole.MANAGER);
    const admin = await createAuth(db, UserRole.ADMIN);
    const payload = createOrderPayload([
      { productId: product.id, quantity: 1 },
    ]);

    await request(app)
      .post("/api/v1/orders")
      .set("Authorization", staff.auth)
      .send(payload)
      .expect(403);
    await request(app)
      .post("/api/v1/orders")
      .set("Authorization", manager.auth)
      .send(payload)
      .expect(403);
    await request(app)
      .post("/api/v1/orders")
      .set("Authorization", admin.auth)
      .send(payload)
      .expect(403);

    const createResponse = await request(app)
      .post("/api/v1/orders")
      .set("Authorization", customer.auth)
      .send(payload)
      .expect(201);

    await request(app)
      .get("/api/v1/orders")
      .set("Authorization", staff.auth)
      .expect(403);
    await request(app)
      .get("/api/v1/orders")
      .set("Authorization", manager.auth)
      .expect(200);
    await request(app)
      .get(`/api/v1/orders/${createResponse.body.data.id}`)
      .set("Authorization", admin.auth)
      .expect(200);
    await request(app)
      .get(`/api/v1/orders/${createResponse.body.data.id}`)
      .set("Authorization", otherCustomer.auth)
      .expect(404);
    await request(app)
      .post(`/api/v1/orders/${createResponse.body.data.id}/cancel`)
      .set("Authorization", otherCustomer.auth)
      .send({ reason: "Not mine" })
      .expect(404);
  });

  it("lists and filters only the authenticated customer's orders", async () => {
    const { app, db } = createOrderTestContext();
    const product = await createProduct(db, { stock: 10 });
    const customer = await createAuth(db, UserRole.CUSTOMER);
    const otherCustomer = await createAuth(db, UserRole.CUSTOMER);

    const firstOrder = await request(app)
      .post("/api/v1/orders")
      .set("Authorization", customer.auth)
      .send(createOrderPayload([{ productId: product.id, quantity: 1 }]))
      .expect(201);
    await request(app)
      .post("/api/v1/orders")
      .set("Authorization", otherCustomer.auth)
      .send(createOrderPayload([{ productId: product.id, quantity: 1 }]))
      .expect(201);

    const listResponse = await request(app)
      .get("/api/v1/orders")
      .query({ status: OrderStatus.PENDING, paymentStatus: "UNPAID" })
      .set("Authorization", customer.auth)
      .expect(200);

    expect(listResponse.body.data).toHaveLength(1);
    expect(listResponse.body.data[0].id).toBe(firstOrder.body.data.id);

    await request(app)
      .get("/api/v1/orders")
      .query({ status: "VOIDED" })
      .set("Authorization", customer.auth)
      .expect(400);
  });

  it("preserves order item snapshots after product updates and creates unique references", async () => {
    const { app, db } = createOrderTestContext();
    const product = await createProduct(db, {
      name: "Snapshot Customer Drink",
      stock: 10,
      sellingPrice: 180,
    });
    const customer = await createAuth(db, UserRole.CUSTOMER);

    const firstOrder = await request(app)
      .post("/api/v1/orders")
      .set("Authorization", customer.auth)
      .send(createOrderPayload([{ productId: product.id, quantity: 2 }]))
      .expect(201);
    const secondOrder = await request(app)
      .post("/api/v1/orders")
      .set("Authorization", customer.auth)
      .send(createOrderPayload([{ productId: product.id, quantity: 1 }]))
      .expect(201);

    expect(firstOrder.body.data.reference).not.toBe(
      secondOrder.body.data.reference,
    );

    await db.product.update({
      where: { id: product.id },
      data: {
        name: "Renamed Customer Drink",
        sku: "ORDER-RENAMED",
        sellingPrice: 240,
      },
    });

    const detailResponse = await request(app)
      .get(`/api/v1/orders/${firstOrder.body.data.id}`)
      .set("Authorization", customer.auth)
      .expect(200);

    expect(detailResponse.body.data.items[0]).toMatchObject({
      productName: "Snapshot Customer Drink",
      productSku: product.sku,
      productUnit: ProductUnit.PACK,
    });
    expect(Number(detailResponse.body.data.items[0].unitPrice)).toBe(180);
    expect(Number(detailResponse.body.data.items[0].lineSubtotal)).toBe(360);
  });

  it("cancels cancellable customer orders and rejects invalid lifecycle transitions", async () => {
    const { app, db } = createOrderTestContext();
    const product = await createProduct(db, { stock: 10 });
    const customer = await createAuth(db, UserRole.CUSTOMER);
    const manager = await createAuth(db, UserRole.MANAGER);

    const orderResponse = await request(app)
      .post("/api/v1/orders")
      .set("Authorization", customer.auth)
      .send(createOrderPayload([{ productId: product.id, quantity: 1 }]))
      .expect(201);

    await request(app)
      .post(`/api/v1/orders/${orderResponse.body.data.id}/cancel`)
      .send({ reason: "No auth" })
      .expect(401);
    await request(app)
      .post(`/api/v1/orders/${orderResponse.body.data.id}/cancel`)
      .set("Authorization", manager.auth)
      .send({ reason: "Management cannot customer-cancel" })
      .expect(403);
    await request(app)
      .post("/api/v1/orders/%20/cancel")
      .set("Authorization", customer.auth)
      .send({ reason: "Bad id" })
      .expect(400);
    await request(app)
      .post(`/api/v1/orders/${orderResponse.body.data.id}/cancel`)
      .set("Authorization", customer.auth)
      .send({ reason: "x".repeat(501) })
      .expect(400);

    const cancelResponse = await request(app)
      .post(`/api/v1/orders/${orderResponse.body.data.id}/cancel`)
      .set("Authorization", customer.auth)
      .send({ reason: "Changed my mind" })
      .expect(200);

    expect(cancelResponse.body.data).toMatchObject({
      id: orderResponse.body.data.id,
      status: OrderStatus.CANCELLED,
      cancelReason: "Changed my mind",
    });
    expect(cancelResponse.body.data.cancelledAt).toEqual(expect.any(String));

    await request(app)
      .post(`/api/v1/orders/${orderResponse.body.data.id}/cancel`)
      .set("Authorization", customer.auth)
      .send({ reason: "Again" })
      .expect(409);

    const fulfilledOrder = await request(app)
      .post("/api/v1/orders")
      .set("Authorization", customer.auth)
      .send(createOrderPayload([{ productId: product.id, quantity: 1 }]))
      .expect(201);
    await db.order.update({
      where: { id: fulfilledOrder.body.data.id },
      data: { status: OrderStatus.FULFILLED },
    });

    await request(app)
      .post(`/api/v1/orders/${fulfilledOrder.body.data.id}/cancel`)
      .set("Authorization", customer.auth)
      .send({ reason: "Fulfilled cannot cancel" })
      .expect(409);
  });

  it("keeps customers out of internal POS, inventory, and reporting APIs", async () => {
    const { app, db } = createOrderTestContext();
    const product = await createProduct(db);
    const customer = await createAuth(db, UserRole.CUSTOMER);

    await request(app)
      .post("/api/v1/sales")
      .set("Authorization", customer.auth)
      .send({
        paymentMethod: "CASH",
        items: [{ productId: product.id, quantity: 1 }],
      })
      .expect(403);
    await request(app)
      .get("/api/v1/inventory")
      .set("Authorization", customer.auth)
      .expect(403);
    await request(app)
      .get("/api/v1/reports/today")
      .set("Authorization", customer.auth)
      .expect(403);
  });
});
