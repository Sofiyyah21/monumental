import jwt from "jsonwebtoken";
import request from "supertest";
import { describe, expect, it } from "vitest";
import {
  OrderPaymentStatus,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  Prisma,
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

  it("allows management order listing filters without exposing other customers to customers", async () => {
    const { app, db } = createOrderTestContext();
    const product = await createProduct(db, { stock: 10 });
    const customer = await createAuth(db, UserRole.CUSTOMER);
    const otherCustomer = await createAuth(db, UserRole.CUSTOMER);
    const manager = await createAuth(db, UserRole.MANAGER);

    const firstOrder = await request(app)
      .post("/api/v1/orders")
      .set("Authorization", customer.auth)
      .send(createOrderPayload([{ productId: product.id, quantity: 1 }]))
      .expect(201);
    const secondOrder = await request(app)
      .post("/api/v1/orders")
      .set("Authorization", otherCustomer.auth)
      .send(createOrderPayload([{ productId: product.id, quantity: 1 }]))
      .expect(201);

    const createdAt = new Date(firstOrder.body.data.createdAt);
    const from = new Date(createdAt.getTime() - 1000).toISOString();
    const to = new Date(createdAt.getTime() + 1000).toISOString();

    const managerList = await request(app)
      .get("/api/v1/orders")
      .query({
        customerId: otherCustomer.user.id,
        from,
        to,
      })
      .set("Authorization", manager.auth)
      .expect(200);
    expect(
      managerList.body.data.map((order: { id: string }) => order.id),
    ).toEqual([secondOrder.body.data.id]);

    const customerList = await request(app)
      .get("/api/v1/orders")
      .query({ customerId: otherCustomer.user.id })
      .set("Authorization", customer.auth)
      .expect(200);
    expect(
      customerList.body.data.map((order: { id: string }) => order.id),
    ).toEqual([firstOrder.body.data.id]);

    await request(app)
      .get("/api/v1/orders")
      .query({ from: "2026-09-20", to: "2026-09-19" })
      .set("Authorization", manager.auth)
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
      .post(`/api/v1/orders/${orderResponse.body.data.id}/confirm`)
      .set("Authorization", manager.auth)
      .expect(200);
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
    expect(cancelResponse.body.data.cancelledById).toBe(customer.user.id);

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

  it("enforces management authorization for confirmation and fulfillment", async () => {
    const { app, db } = createOrderTestContext();
    const product = await createProduct(db, { stock: 10 });
    const customer = await createAuth(db, UserRole.CUSTOMER);
    const staff = await createAuth(db, UserRole.STAFF);
    const manager = await createAuth(db, UserRole.MANAGER);
    const admin = await createAuth(db, UserRole.ADMIN);

    const orderResponse = await request(app)
      .post("/api/v1/orders")
      .set("Authorization", customer.auth)
      .send(createOrderPayload([{ productId: product.id, quantity: 1 }]))
      .expect(201);

    await request(app)
      .post(`/api/v1/orders/${orderResponse.body.data.id}/confirm`)
      .expect(401);
    await request(app)
      .post(`/api/v1/orders/${orderResponse.body.data.id}/confirm`)
      .set("Authorization", customer.auth)
      .expect(403);
    await request(app)
      .post(`/api/v1/orders/${orderResponse.body.data.id}/confirm`)
      .set("Authorization", staff.auth)
      .expect(403);
    await request(app)
      .post(`/api/v1/orders/${orderResponse.body.data.id}/cancel`)
      .set("Authorization", staff.auth)
      .send({ reason: "Staff cannot cancel" })
      .expect(403);

    const confirmResponse = await request(app)
      .post(`/api/v1/orders/${orderResponse.body.data.id}/confirm`)
      .set("Authorization", manager.auth)
      .expect(200);

    expect(confirmResponse.body.data).toMatchObject({
      status: OrderStatus.CONFIRMED,
      confirmedById: manager.user.id,
    });
    expect(confirmResponse.body.data.confirmedAt).toEqual(expect.any(String));

    await request(app)
      .post(`/api/v1/orders/${orderResponse.body.data.id}/fulfill`)
      .set("Authorization", customer.auth)
      .expect(403);
    await request(app)
      .post(`/api/v1/orders/${orderResponse.body.data.id}/fulfill`)
      .set("Authorization", staff.auth)
      .expect(403);

    await request(app)
      .post(`/api/v1/orders/${orderResponse.body.data.id}/fulfill`)
      .set("Authorization", admin.auth)
      .expect(409);
    await request(app)
      .post(`/api/v1/orders/${orderResponse.body.data.id}/payment/verify`)
      .set("Authorization", admin.auth)
      .send({ paymentMethod: PaymentMethod.TRANSFER })
      .expect(200);

    const fulfillResponse = await request(app)
      .post(`/api/v1/orders/${orderResponse.body.data.id}/fulfill`)
      .set("Authorization", admin.auth)
      .expect(200);

    expect(fulfillResponse.body.data).toMatchObject({
      status: OrderStatus.FULFILLED,
      fulfilledById: admin.user.id,
    });
    expect(fulfillResponse.body.data.fulfilledAt).toEqual(expect.any(String));
  });

  it("enforces explicit order lifecycle transitions", async () => {
    const { app, db } = createOrderTestContext();
    const product = await createProduct(db, { stock: 10 });
    const customer = await createAuth(db, UserRole.CUSTOMER);
    const manager = await createAuth(db, UserRole.MANAGER);

    const pendingOrder = await request(app)
      .post("/api/v1/orders")
      .set("Authorization", customer.auth)
      .send(createOrderPayload([{ productId: product.id, quantity: 1 }]))
      .expect(201);

    await request(app)
      .post(`/api/v1/orders/${pendingOrder.body.data.id}/fulfill`)
      .set("Authorization", manager.auth)
      .expect(409);

    const confirmedOrder = await request(app)
      .post(`/api/v1/orders/${pendingOrder.body.data.id}/confirm`)
      .set("Authorization", manager.auth)
      .expect(200);
    expect(confirmedOrder.body.data.status).toBe(OrderStatus.CONFIRMED);

    await request(app)
      .post(`/api/v1/orders/${pendingOrder.body.data.id}/confirm`)
      .set("Authorization", manager.auth)
      .expect(409);

    await request(app)
      .post(`/api/v1/orders/${pendingOrder.body.data.id}/fulfill`)
      .set("Authorization", manager.auth)
      .expect(409);
    await request(app)
      .post(`/api/v1/orders/${pendingOrder.body.data.id}/payment/verify`)
      .set("Authorization", manager.auth)
      .send({ paymentMethod: PaymentMethod.CARD })
      .expect(200);

    const fulfilledOrder = await request(app)
      .post(`/api/v1/orders/${pendingOrder.body.data.id}/fulfill`)
      .set("Authorization", manager.auth)
      .expect(200);
    expect(fulfilledOrder.body.data.status).toBe(OrderStatus.FULFILLED);

    await request(app)
      .post(`/api/v1/orders/${pendingOrder.body.data.id}/cancel`)
      .set("Authorization", manager.auth)
      .send({ reason: "Too late" })
      .expect(409);
    await request(app)
      .post(`/api/v1/orders/${pendingOrder.body.data.id}/confirm`)
      .set("Authorization", manager.auth)
      .expect(409);

    const cancelFromPending = await request(app)
      .post("/api/v1/orders")
      .set("Authorization", customer.auth)
      .send(createOrderPayload([{ productId: product.id, quantity: 1 }]))
      .expect(201);
    await request(app)
      .post(`/api/v1/orders/${cancelFromPending.body.data.id}/cancel`)
      .set("Authorization", manager.auth)
      .send({ reason: "Manager cancelled" })
      .expect(200);
    await request(app)
      .post(`/api/v1/orders/${cancelFromPending.body.data.id}/confirm`)
      .set("Authorization", manager.auth)
      .expect(409);
    await request(app)
      .post(`/api/v1/orders/${cancelFromPending.body.data.id}/fulfill`)
      .set("Authorization", manager.auth)
      .expect(409);

    const cancelFromConfirmed = await request(app)
      .post("/api/v1/orders")
      .set("Authorization", customer.auth)
      .send(createOrderPayload([{ productId: product.id, quantity: 1 }]))
      .expect(201);
    await request(app)
      .post(`/api/v1/orders/${cancelFromConfirmed.body.data.id}/confirm`)
      .set("Authorization", manager.auth)
      .expect(200);
    const cancelledConfirmed = await request(app)
      .post(`/api/v1/orders/${cancelFromConfirmed.body.data.id}/cancel`)
      .set("Authorization", manager.auth)
      .send({ reason: "Cannot supply" })
      .expect(200);

    expect(cancelledConfirmed.body.data).toMatchObject({
      status: OrderStatus.CANCELLED,
      cancelledById: manager.user.id,
      cancelReason: "Cannot supply",
    });
  });

  it("verifies payment only for confirmed unpaid orders with management authorization", async () => {
    const { app, db } = createOrderTestContext();
    const product = await createProduct(db, { stock: 10 });
    const customer = await createAuth(db, UserRole.CUSTOMER);
    const staff = await createAuth(db, UserRole.STAFF);
    const manager = await createAuth(db, UserRole.MANAGER);
    const admin = await createAuth(db, UserRole.ADMIN);

    const orderResponse = await request(app)
      .post("/api/v1/orders")
      .set("Authorization", customer.auth)
      .send(createOrderPayload([{ productId: product.id, quantity: 1 }]))
      .expect(201);

    await request(app)
      .post(`/api/v1/orders/${orderResponse.body.data.id}/payment/verify`)
      .expect(401);
    await request(app)
      .post(`/api/v1/orders/${orderResponse.body.data.id}/payment/verify`)
      .set("Authorization", customer.auth)
      .send({ paymentMethod: PaymentMethod.TRANSFER })
      .expect(403);
    await request(app)
      .post(`/api/v1/orders/${orderResponse.body.data.id}/payment/verify`)
      .set("Authorization", staff.auth)
      .send({ paymentMethod: PaymentMethod.TRANSFER })
      .expect(403);
    await request(app)
      .post(`/api/v1/orders/${orderResponse.body.data.id}/payment/verify`)
      .set("Authorization", manager.auth)
      .send({ paymentMethod: PaymentMethod.TRANSFER })
      .expect(409);

    await request(app)
      .post(`/api/v1/orders/${orderResponse.body.data.id}/confirm`)
      .set("Authorization", manager.auth)
      .expect(200);

    const verifyResponse = await request(app)
      .post(`/api/v1/orders/${orderResponse.body.data.id}/payment/verify`)
      .set("Authorization", admin.auth)
      .send({
        amount: 1,
        paidById: customer.user.id,
        paymentMethod: PaymentMethod.TRANSFER,
        paymentStatus: OrderPaymentStatus.FAILED,
      })
      .expect(200);

    expect(verifyResponse.body.data).toMatchObject({
      status: OrderStatus.CONFIRMED,
      paymentMethod: PaymentMethod.TRANSFER,
      paymentStatus: OrderPaymentStatus.PAID,
      paidById: admin.user.id,
    });
    expect(verifyResponse.body.data.paidAt).toEqual(expect.any(String));

    await request(app)
      .post(`/api/v1/orders/${orderResponse.body.data.id}/payment/verify`)
      .set("Authorization", manager.auth)
      .send({ paymentMethod: PaymentMethod.TRANSFER })
      .expect(409);
    await request(app)
      .post(`/api/v1/orders/${orderResponse.body.data.id}/cancel`)
      .set("Authorization", manager.auth)
      .send({ reason: "Paid order needs refund workflow" })
      .expect(409);
    await request(app)
      .post(`/api/v1/orders/${orderResponse.body.data.id}/fulfill`)
      .set("Authorization", manager.auth)
      .expect(200);
    await request(app)
      .post(`/api/v1/orders/${orderResponse.body.data.id}/payment/verify`)
      .set("Authorization", manager.auth)
      .send({ paymentMethod: PaymentMethod.TRANSFER })
      .expect(409);

    const customerDetail = await request(app)
      .get(`/api/v1/orders/${orderResponse.body.data.id}`)
      .set("Authorization", customer.auth)
      .expect(200);
    expect(customerDetail.body.data.paymentStatus).toBe(
      OrderPaymentStatus.PAID,
    );
    expect(customerDetail.body.data.paidAt).toEqual(expect.any(String));
    expect(customerDetail.body.data.paidById).toBeUndefined();

    const cancelledOrder = await request(app)
      .post("/api/v1/orders")
      .set("Authorization", customer.auth)
      .send(createOrderPayload([{ productId: product.id, quantity: 1 }]))
      .expect(201);
    await db.order.update({
      where: { id: cancelledOrder.body.data.id },
      data: { status: OrderStatus.CANCELLED },
    });
    await request(app)
      .post(`/api/v1/orders/${cancelledOrder.body.data.id}/payment/verify`)
      .set("Authorization", manager.auth)
      .send({ paymentMethod: PaymentMethod.TRANSFER })
      .expect(409);

    const failedPaymentOrder = await request(app)
      .post("/api/v1/orders")
      .set("Authorization", customer.auth)
      .send(createOrderPayload([{ productId: product.id, quantity: 1 }]))
      .expect(201);
    await db.order.update({
      where: { id: failedPaymentOrder.body.data.id },
      data: {
        status: OrderStatus.CONFIRMED,
        paymentStatus: OrderPaymentStatus.FAILED,
      },
    });
    await request(app)
      .post(`/api/v1/orders/${failedPaymentOrder.body.data.id}/payment/verify`)
      .set("Authorization", manager.auth)
      .send({ paymentMethod: PaymentMethod.TRANSFER })
      .expect(409);
  });

  it("finalizes fulfilled orders into sales and inventory movements only at fulfillment", async () => {
    const { app, db, saleItems, sales, stockMovements } =
      createOrderTestContext();
    const product = await createProduct(db, { stock: 7 });
    const customer = await createAuth(db, UserRole.CUSTOMER);
    const manager = await createAuth(db, UserRole.MANAGER);

    const orderResponse = await request(app)
      .post("/api/v1/orders")
      .set("Authorization", customer.auth)
      .send(createOrderPayload([{ productId: product.id, quantity: 2 }]))
      .expect(201);

    await request(app)
      .post(`/api/v1/orders/${orderResponse.body.data.id}/confirm`)
      .set("Authorization", manager.auth)
      .expect(200);
    await request(app)
      .post(`/api/v1/orders/${orderResponse.body.data.id}/payment/verify`)
      .set("Authorization", manager.auth)
      .send({ paymentMethod: PaymentMethod.CASH })
      .expect(200);

    expect(sales.size).toBe(0);
    expect(stockMovements.size).toBe(0);

    const fulfillResponse = await request(app)
      .post(`/api/v1/orders/${orderResponse.body.data.id}/fulfill`)
      .set("Authorization", manager.auth)
      .expect(200);
    expect(fulfillResponse.body.data).toMatchObject({
      status: OrderStatus.FULFILLED,
      saleReference: expect.stringMatching(/^MD-\d{8}-\d{5}$/),
    });

    const storedProduct = await db.product.findUniqueOrThrow({
      where: { id: product.id },
    });
    expect(Number(storedProduct.currentStock)).toBe(5);
    expect(sales.size).toBe(1);
    expect(saleItems.size).toBe(1);
    expect(stockMovements.size).toBe(1);
    const [sale] = [...sales.values()];
    const [saleItem] = [...saleItems.values()];
    const [movement] = [...stockMovements.values()];
    expect(sale).toMatchObject({
      orderId: orderResponse.body.data.id,
      customerId: customer.user.id,
      sellerId: manager.user.id,
      paymentMethod: PaymentMethod.CASH,
      paymentStatus: PaymentStatus.PAID,
    });
    expect(Number(sale?.subtotal)).toBe(300);
    expect(Number(sale?.totalCost)).toBe(200);
    expect(Number(sale?.grossProfit)).toBe(100);
    expect(saleItem).toMatchObject({
      saleId: sale?.id,
      productName: product.name,
      productUnit: product.unit,
    });
    expect(Number(saleItem?.unitPrice)).toBe(150);
    expect(Number(saleItem?.unitCost)).toBe(100);
    expect(movement).toMatchObject({
      saleId: sale?.id,
      type: StockMovementType.SOLD,
      reference: sale?.reference,
      createdById: manager.user.id,
    });
    expect(Number(movement?.previousStock)).toBe(7);
    expect(Number(movement?.newStock)).toBe(5);

    await request(app)
      .post(`/api/v1/orders/${orderResponse.body.data.id}/fulfill`)
      .set("Authorization", manager.auth)
      .expect(409);
    expect(sales.size).toBe(1);
    expect(stockMovements.size).toBe(1);

    const cancellableOrder = await request(app)
      .post("/api/v1/orders")
      .set("Authorization", customer.auth)
      .send(createOrderPayload([{ productId: product.id, quantity: 1 }]))
      .expect(201);
    await request(app)
      .post(`/api/v1/orders/${cancellableOrder.body.data.id}/cancel`)
      .set("Authorization", manager.auth)
      .send({ reason: "No stock reservation to restore" })
      .expect(200);
    expect(
      Number(
        (
          await db.product.findUniqueOrThrow({
            where: { id: product.id },
          })
        ).currentStock,
      ),
    ).toBe(5);
    expect(stockMovements.size).toBe(1);
    expect(sales.size).toBe(1);
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
