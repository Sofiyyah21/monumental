import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
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
import { prisma } from "../lib/prisma.js";
import {
  InMemoryNotificationProvider,
  notificationEventTypes,
} from "../services/notification.service.js";
import { assertSafeTestDatabaseUrl } from "./test-database-url.js";

const runE2E = process.env.RUN_E2E_TESTS === "true";
const describeE2E = runE2E ? describe : describe.skip;
const emailDomain = "order-e2e.test";
const skuPrefix = "ORDER-E2E";
const password = "E2ePassword123!";

type AuthSession = {
  userId: string;
  email: string;
  accessToken: string;
  cookie: string;
};

function uniqueToken(label: string) {
  return `${label}-${crypto.randomUUID()}`;
}

function safeJson(value: unknown) {
  return JSON.stringify(value);
}

function normalizeSetCookieHeader(header: string | string[] | undefined) {
  if (!header) {
    return [];
  }
  return Array.isArray(header) ? header : [header];
}

function expectCustomerSafeOrderPayload(payload: unknown) {
  const text = safeJson(payload);
  for (const forbidden of [
    "passwordHash",
    "accessToken",
    "refreshToken",
    "paidById",
    "confirmedById",
    "fulfilledById",
    "voidedById",
    "costPrice",
    "unitCost",
    "lineCost",
    "totalCost",
    "cogs",
    "grossProfit",
    "currentStock",
    "reorderLevel",
    "stockMovement",
  ]) {
    expect(text).not.toContain(forbidden);
  }
}

function expectCustomerSafeProductPayload(payload: unknown) {
  const text = safeJson(payload);
  for (const forbidden of [
    "costPrice",
    "unitCost",
    "lineCost",
    "totalCost",
    "cogs",
    "grossProfit",
    "currentStock",
    "reorderLevel",
    "stockMovement",
  ]) {
    expect(text).not.toContain(forbidden);
  }
}

async function cleanupE2EData() {
  await prisma.stockMovement.deleteMany({
    where: {
      OR: [
        { product: { sku: { startsWith: skuPrefix } } },
        { createdBy: { email: { endsWith: `@${emailDomain}` } } },
      ],
    },
  });
  await prisma.sale.deleteMany({
    where: {
      OR: [
        { seller: { email: { endsWith: `@${emailDomain}` } } },
        { customer: { email: { endsWith: `@${emailDomain}` } } },
        { items: { some: { product: { sku: { startsWith: skuPrefix } } } } },
      ],
    },
  });
  await prisma.order.deleteMany({
    where: {
      OR: [
        { customer: { email: { endsWith: `@${emailDomain}` } } },
        { items: { some: { product: { sku: { startsWith: skuPrefix } } } } },
      ],
    },
  });
  await prisma.product.deleteMany({
    where: { sku: { startsWith: skuPrefix } },
  });
  await prisma.user.deleteMany({
    where: { email: { endsWith: `@${emailDomain}` } },
  });
}

async function createUser(role: UserRole, label: string) {
  return prisma.user.create({
    data: {
      email: `${uniqueToken(label)}@${emailDomain}`,
      name: `${label} ${role}`,
      passwordHash: await bcrypt.hash(password, 10),
      role,
    },
  });
}

async function login(
  app: ReturnType<typeof createApp>,
  user: { id: string; email: string },
) {
  const response = await request(app)
    .post("/api/v1/auth/login")
    .send({ email: user.email, password })
    .expect(200);

  expect(response.body.data.accessToken).toEqual(expect.any(String));
  expect(response.body.data.refreshToken).toBeUndefined();
  expect(safeJson(response.body)).not.toContain("passwordHash");

  const setCookie = normalizeSetCookieHeader(response.headers["set-cookie"]);
  const cookieText = setCookie.join("; ");
  expect(cookieText).toContain("md_refresh_token=");
  expect(cookieText).toContain("HttpOnly");

  return {
    userId: user.id,
    email: user.email,
    accessToken: response.body.data.accessToken as string,
    cookie: setCookie.map((cookie) => cookie.split(";")[0]).join("; "),
  } satisfies AuthSession;
}

async function registerCustomer(app: ReturnType<typeof createApp>) {
  const email = `${uniqueToken("customer")}@${emailDomain}`;
  await request(app)
    .post("/api/v1/auth/register")
    .send({ email, name: "E2E Customer", password })
    .expect(201);

  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  return login(app, user);
}

async function createManagementSessions(app: ReturnType<typeof createApp>) {
  const [admin, manager, staff] = await Promise.all([
    createUser(UserRole.ADMIN, "admin"),
    createUser(UserRole.MANAGER, "manager"),
    createUser(UserRole.STAFF, "staff"),
  ]);

  return {
    admin: await login(app, admin),
    manager: await login(app, manager),
    staff: await login(app, staff),
  };
}

async function createProductThroughApi(
  app: ReturnType<typeof createApp>,
  auth: AuthSession,
  input: {
    name?: string;
    sku?: string;
    sellingPrice?: number;
    costPrice?: number;
    reorderLevel?: number;
  } = {},
) {
  const response = await request(app)
    .post("/api/v1/products")
    .set("Authorization", `Bearer ${auth.accessToken}`)
    .send({
      name: input.name ?? `E2E Product ${crypto.randomUUID()}`,
      sku: input.sku ?? `${skuPrefix}-${crypto.randomUUID()}`,
      category: ProductCategory.DRINKS,
      unit: ProductUnit.PACK,
      costPrice: input.costPrice ?? 100,
      sellingPrice: input.sellingPrice ?? 150,
      reorderLevel: input.reorderLevel ?? 2,
    })
    .expect(201);

  return response.body.data as { id: string; sku: string; name: string };
}

async function receiveStockThroughApi(
  app: ReturnType<typeof createApp>,
  auth: AuthSession,
  productId: string,
  quantity: number,
) {
  await request(app)
    .post("/api/v1/inventory/receive")
    .set("Authorization", `Bearer ${auth.accessToken}`)
    .send({
      productId,
      quantity,
      unit: ProductUnit.PACK,
      reference: `E2E-RECEIVE-${crypto.randomUUID()}`,
      note: "E2E stock receipt",
    })
    .expect(201);
}

async function createReadyOrder(input: {
  app: ReturnType<typeof createApp>;
  manager: AuthSession;
  customer: AuthSession;
  productId: string;
  quantity?: number;
  paymentMethod?: PaymentMethod;
}) {
  const orderResponse = await request(input.app)
    .post("/api/v1/orders")
    .set("Authorization", `Bearer ${input.customer.accessToken}`)
    .send({
      items: [{ productId: input.productId, quantity: input.quantity ?? 1 }],
    })
    .expect(201);
  const orderId = orderResponse.body.data.id as string;

  await request(input.app)
    .post(`/api/v1/orders/${orderId}/confirm`)
    .set("Authorization", `Bearer ${input.manager.accessToken}`)
    .expect(200);
  await request(input.app)
    .post(`/api/v1/orders/${orderId}/payment/verify`)
    .set("Authorization", `Bearer ${input.manager.accessToken}`)
    .send({ paymentMethod: input.paymentMethod ?? PaymentMethod.TRANSFER })
    .expect(200);

  return orderId;
}

function notificationTypes(provider: InMemoryNotificationProvider) {
  return provider.events.map((event) => event.type);
}

async function countSoldMovements(productId: string) {
  return prisma.stockMovement.count({
    where: { productId, type: StockMovementType.SOLD },
  });
}

describeE2E("customer order HTTP E2E workflows", () => {
  let notificationProvider: InMemoryNotificationProvider;
  let app: ReturnType<typeof createApp>;

  beforeAll(async () => {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL is required for E2E tests.");
    }
    assertSafeTestDatabaseUrl(process.env.DATABASE_URL);
    await prisma.$connect();
  });

  beforeEach(async () => {
    await cleanupE2EData();
    notificationProvider = new InMemoryNotificationProvider();
    app = createApp(prisma, { notificationProvider });
  });

  afterAll(async () => {
    await cleanupE2EData();
    await prisma.$disconnect();
  });

  it("covers the complete customer order lifecycle over HTTP", async () => {
    const { admin, manager } = await createManagementSessions(app);
    const customer = await registerCustomer(app);

    const me = await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .expect(200);
    expect(me.body.data).toMatchObject({
      id: admin.userId,
      role: UserRole.ADMIN,
    });

    const product = await createProductThroughApi(app, admin, {
      name: "E2E Monumental Drink",
      sellingPrice: 150,
      costPrice: 100,
    });
    await receiveStockThroughApi(app, manager, product.id, 5);

    const inventoryBefore = await request(app)
      .get(`/api/v1/inventory/products/${product.id}`)
      .set("Authorization", `Bearer ${manager.accessToken}`)
      .expect(200);
    expect(Number(inventoryBefore.body.data.currentStock)).toBe(5);

    const catalog = await request(app)
      .get("/api/v1/products")
      .query({ search: "Monumental Drink" })
      .set("Authorization", `Bearer ${customer.accessToken}`)
      .expect(200);
    expect(catalog.body.data).toHaveLength(1);
    expect(catalog.body.data[0]).toMatchObject({
      id: product.id,
      sku: product.sku,
      category: ProductCategory.DRINKS,
      unit: ProductUnit.PACK,
      availability: "AVAILABLE",
    });
    expect(Number(catalog.body.data[0].sellingPrice)).toBe(150);
    expectCustomerSafeProductPayload(catalog.body.data);

    const orderResponse = await request(app)
      .post("/api/v1/orders")
      .set("Authorization", `Bearer ${customer.accessToken}`)
      .send({
        items: [{ productId: product.id, quantity: 2 }],
        subtotal: 1,
        customerId: admin.userId,
      })
      .expect(201);
    const order = orderResponse.body.data;
    expect(order.reference).toMatch(/^MD-ORD-\d{8}-\d{5}$/);
    expect(order.status).toBe(OrderStatus.PENDING);
    expect(order.paymentStatus).toBe(OrderPaymentStatus.UNPAID);
    expect(Number(order.subtotal)).toBe(300);
    expect(order.items[0]).toMatchObject({
      productId: product.id,
      productName: "E2E Monumental Drink",
      productSku: product.sku,
      productUnit: ProductUnit.PACK,
    });
    expect(Number(order.items[0].unitPrice)).toBe(150);
    expect(notificationTypes(notificationProvider)).toEqual([
      notificationEventTypes.ORDER_CREATED,
    ]);
    expectCustomerSafeOrderPayload(order);

    expect(
      Number(
        (
          await prisma.product.findUniqueOrThrow({
            where: { id: product.id },
          })
        ).currentStock,
      ),
    ).toBe(5);
    expect(await prisma.sale.count({ where: { orderId: order.id } })).toBe(0);

    const customerOrder = await request(app)
      .get(`/api/v1/orders/${order.id}`)
      .set("Authorization", `Bearer ${customer.accessToken}`)
      .expect(200);
    expect(customerOrder.body.data.id).toBe(order.id);
    expectCustomerSafeOrderPayload(customerOrder.body.data);

    const confirmed = await request(app)
      .post(`/api/v1/orders/${order.id}/confirm`)
      .set("Authorization", `Bearer ${manager.accessToken}`)
      .expect(200);
    expect(confirmed.body.data).toMatchObject({
      status: OrderStatus.CONFIRMED,
      confirmedById: manager.userId,
    });
    expect(confirmed.body.data.confirmedAt).toEqual(expect.any(String));
    expect(notificationTypes(notificationProvider)).toContain(
      notificationEventTypes.ORDER_CONFIRMED,
    );

    const customerConfirmed = await request(app)
      .get(`/api/v1/orders/${order.id}`)
      .set("Authorization", `Bearer ${customer.accessToken}`)
      .expect(200);
    expect(customerConfirmed.body.data.status).toBe(OrderStatus.CONFIRMED);
    expectCustomerSafeOrderPayload(customerConfirmed.body.data);

    const paid = await request(app)
      .post(`/api/v1/orders/${order.id}/payment/verify`)
      .set("Authorization", `Bearer ${manager.accessToken}`)
      .send({ paymentMethod: PaymentMethod.TRANSFER })
      .expect(200);
    expect(paid.body.data).toMatchObject({
      status: OrderStatus.CONFIRMED,
      paymentStatus: OrderPaymentStatus.PAID,
      paymentMethod: PaymentMethod.TRANSFER,
      paidById: manager.userId,
    });
    expect(paid.body.data.paidAt).toEqual(expect.any(String));
    expect(notificationTypes(notificationProvider)).toContain(
      notificationEventTypes.PAYMENT_VERIFIED,
    );

    const customerPaid = await request(app)
      .get(`/api/v1/orders/${order.id}`)
      .set("Authorization", `Bearer ${customer.accessToken}`)
      .expect(200);
    expect(customerPaid.body.data.paymentStatus).toBe(OrderPaymentStatus.PAID);
    expect(customerPaid.body.data.paidAt).toEqual(expect.any(String));
    expectCustomerSafeOrderPayload(customerPaid.body.data);
    expect(
      Number(
        (
          await prisma.product.findUniqueOrThrow({
            where: { id: product.id },
          })
        ).currentStock,
      ),
    ).toBe(5);
    expect(await prisma.sale.count({ where: { orderId: order.id } })).toBe(0);

    const fulfilled = await request(app)
      .post(`/api/v1/orders/${order.id}/fulfill`)
      .set("Authorization", `Bearer ${manager.accessToken}`)
      .expect(200);
    expect(fulfilled.body.data).toMatchObject({
      status: OrderStatus.FULFILLED,
      fulfilledById: manager.userId,
      saleReference: expect.stringMatching(/^MD-\d{8}-\d{5}$/),
    });
    expect(fulfilled.body.data.fulfilledAt).toEqual(expect.any(String));
    expect(notificationTypes(notificationProvider)).toEqual([
      notificationEventTypes.ORDER_CREATED,
      notificationEventTypes.ORDER_CONFIRMED,
      notificationEventTypes.PAYMENT_VERIFIED,
      notificationEventTypes.ORDER_FULFILLED,
    ]);

    const sale = await prisma.sale.findUniqueOrThrow({
      where: { orderId: order.id },
      include: { items: true },
    });
    expect(sale).toMatchObject({
      orderId: order.id,
      customerId: customer.userId,
      sellerId: manager.userId,
      paymentMethod: PaymentMethod.TRANSFER,
      paymentStatus: PaymentStatus.PAID,
    });
    expect(Number(sale.subtotal)).toBe(300);
    expect(Number(sale.totalAmount)).toBe(300);
    expect(Number(sale.totalCost)).toBe(200);
    expect(Number(sale.grossProfit)).toBe(100);
    expect(sale.items).toHaveLength(1);
    expect(sale.items[0]).toMatchObject({
      productId: product.id,
      productName: "E2E Monumental Drink",
      productUnit: ProductUnit.PACK,
    });
    expect(Number(sale.items[0].quantity)).toBe(2);
    expect(Number(sale.items[0].unitPrice)).toBe(150);
    expect(Number(sale.items[0].unitCost)).toBe(100);

    const storedProduct = await prisma.product.findUniqueOrThrow({
      where: { id: product.id },
    });
    expect(Number(storedProduct.currentStock)).toBe(3);
    const soldMovement = await prisma.stockMovement.findFirstOrThrow({
      where: {
        saleId: sale.id,
        productId: product.id,
        type: StockMovementType.SOLD,
      },
    });
    expect(Number(soldMovement.quantity)).toBe(2);
    expect(Number(soldMovement.previousStock)).toBe(5);
    expect(Number(soldMovement.newStock)).toBe(3);

    await request(app)
      .post(`/api/v1/orders/${order.id}/fulfill`)
      .set("Authorization", `Bearer ${manager.accessToken}`)
      .expect(409);
    expect(await prisma.sale.count({ where: { orderId: order.id } })).toBe(1);
    expect(await countSoldMovements(product.id)).toBe(1);
    expect(
      Number(
        (await prisma.product.findUniqueOrThrow({ where: { id: product.id } }))
          .currentStock,
      ),
    ).toBe(3);
    expect(
      notificationProvider.events.filter(
        (event) => event.type === notificationEventTypes.ORDER_FULFILLED,
      ),
    ).toHaveLength(1);

    const reportFrom = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const reportTo = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const salesReport = await request(app)
      .get("/api/v1/reports/sales")
      .query({ from: reportFrom, to: reportTo })
      .set("Authorization", `Bearer ${manager.accessToken}`)
      .expect(200);
    expect(salesReport.body.data.salesCount).toBe(1);
    expect(Number(salesReport.body.data.unitsSold)).toBe(2);
    expect(Number(salesReport.body.data.revenue)).toBe(300);
    expect(Number(salesReport.body.data.cogs)).toBe(200);
    expect(Number(salesReport.body.data.grossProfit)).toBe(100);
  });

  it("rolls back fulfillment when stock is insufficient", async () => {
    const { manager } = await createManagementSessions(app);
    const customer = await registerCustomer(app);
    const product = await createProductThroughApi(app, manager, {
      sellingPrice: 150,
      costPrice: 100,
    });
    await receiveStockThroughApi(app, manager, product.id, 2);
    const orderId = await createReadyOrder({
      app,
      manager,
      customer,
      productId: product.id,
      quantity: 2,
      paymentMethod: PaymentMethod.CASH,
    });

    await prisma.product.update({
      where: { id: product.id },
      data: { currentStock: new Prisma.Decimal(1) },
    });
    notificationProvider.clear();

    await request(app)
      .post(`/api/v1/orders/${orderId}/fulfill`)
      .set("Authorization", `Bearer ${manager.accessToken}`)
      .expect(409);

    const order = await prisma.order.findUniqueOrThrow({
      where: { id: orderId },
    });
    expect(order.status).toBe(OrderStatus.CONFIRMED);
    expect(order.paymentStatus).toBe(OrderPaymentStatus.PAID);
    expect(order.fulfilledAt).toBeNull();
    expect(await prisma.sale.count({ where: { orderId } })).toBe(0);
    expect(
      await prisma.saleItem.count({
        where: { sale: { orderId } },
      }),
    ).toBe(0);
    expect(
      Number(
        (await prisma.product.findUniqueOrThrow({ where: { id: product.id } }))
          .currentStock,
      ),
    ).toBe(1);
    expect(await countSoldMovements(product.id)).toBe(0);
    expect(notificationProvider.events).toHaveLength(0);
  });

  it("allows only one concurrent fulfillment to finalize a paid order", async () => {
    const { manager, admin } = await createManagementSessions(app);
    const customer = await registerCustomer(app);
    const product = await createProductThroughApi(app, manager);
    await receiveStockThroughApi(app, manager, product.id, 5);
    const orderId = await createReadyOrder({
      app,
      manager,
      customer,
      productId: product.id,
      quantity: 2,
      paymentMethod: PaymentMethod.CARD,
    });

    notificationProvider.clear();
    const results = await Promise.allSettled([
      request(app)
        .post(`/api/v1/orders/${orderId}/fulfill`)
        .set("Authorization", `Bearer ${manager.accessToken}`),
      request(app)
        .post(`/api/v1/orders/${orderId}/fulfill`)
        .set("Authorization", `Bearer ${admin.accessToken}`),
    ]);

    const statuses = results.map((result) =>
      result.status === "fulfilled" ? result.value.status : 500,
    );
    expect(statuses.filter((status) => status === 200)).toHaveLength(1);
    expect(statuses.filter((status) => status === 409)).toHaveLength(1);

    const order = await prisma.order.findUniqueOrThrow({
      where: { id: orderId },
    });
    expect(order.status).toBe(OrderStatus.FULFILLED);
    expect(await prisma.sale.count({ where: { orderId } })).toBe(1);
    expect(await countSoldMovements(product.id)).toBe(1);
    expect(
      Number(
        (await prisma.product.findUniqueOrThrow({ where: { id: product.id } }))
          .currentStock,
      ),
    ).toBe(3);
    expect(
      notificationProvider.events.filter(
        (event) => event.type === notificationEventTypes.ORDER_FULFILLED,
      ),
    ).toHaveLength(1);
  });

  it("enforces role boundaries, ownership, and invalid lifecycle transitions", async () => {
    const { admin, manager, staff } = await createManagementSessions(app);
    const customer = await registerCustomer(app);
    const otherCustomer = await registerCustomer(app);
    const product = await createProductThroughApi(app, admin);
    await receiveStockThroughApi(app, manager, product.id, 5);

    const orderResponse = await request(app)
      .post("/api/v1/orders")
      .set("Authorization", `Bearer ${customer.accessToken}`)
      .send({ items: [{ productId: product.id, quantity: 1 }] })
      .expect(201);
    const orderId = orderResponse.body.data.id as string;

    await request(app)
      .post(`/api/v1/orders/${orderId}/confirm`)
      .set("Authorization", `Bearer ${customer.accessToken}`)
      .expect(403);
    await request(app)
      .post(`/api/v1/orders/${orderId}/payment/verify`)
      .set("Authorization", `Bearer ${customer.accessToken}`)
      .send({ paymentMethod: PaymentMethod.CASH })
      .expect(403);
    await request(app)
      .post(`/api/v1/orders/${orderId}/fulfill`)
      .set("Authorization", `Bearer ${customer.accessToken}`)
      .expect(403);
    await request(app)
      .get("/api/v1/inventory")
      .set("Authorization", `Bearer ${customer.accessToken}`)
      .expect(403);
    await request(app)
      .get("/api/v1/reports/today")
      .set("Authorization", `Bearer ${customer.accessToken}`)
      .expect(403);
    await request(app)
      .get("/api/v1/sales")
      .set("Authorization", `Bearer ${customer.accessToken}`)
      .expect(403);

    await request(app)
      .post(`/api/v1/orders/${orderId}/confirm`)
      .set("Authorization", `Bearer ${staff.accessToken}`)
      .expect(403);
    await request(app)
      .post(`/api/v1/orders/${orderId}/payment/verify`)
      .set("Authorization", `Bearer ${staff.accessToken}`)
      .send({ paymentMethod: PaymentMethod.CASH })
      .expect(403);
    await request(app)
      .post(`/api/v1/orders/${orderId}/fulfill`)
      .set("Authorization", `Bearer ${staff.accessToken}`)
      .expect(403);
    await request(app)
      .get("/api/v1/products")
      .set("Authorization", `Bearer ${staff.accessToken}`)
      .expect(200);
    await request(app)
      .post("/api/v1/sales")
      .set("Authorization", `Bearer ${staff.accessToken}`)
      .send({
        paymentMethod: PaymentMethod.CASH,
        items: [{ productId: product.id, quantity: 1 }],
      })
      .expect(201);

    await request(app)
      .get(`/api/v1/orders/${orderId}`)
      .set("Authorization", `Bearer ${otherCustomer.accessToken}`)
      .expect(404);
    await request(app)
      .post(`/api/v1/orders/${orderId}/cancel`)
      .set("Authorization", `Bearer ${otherCustomer.accessToken}`)
      .send({ reason: "Not mine" })
      .expect(404);
    await request(app)
      .get("/api/v1/orders")
      .query({ customerId: customer.userId })
      .set("Authorization", `Bearer ${otherCustomer.accessToken}`)
      .expect(200)
      .expect((response) => {
        expect(response.body.data).toHaveLength(0);
      });

    await request(app)
      .post(`/api/v1/orders/${orderId}/fulfill`)
      .set("Authorization", `Bearer ${manager.accessToken}`)
      .expect(409);
    await request(app)
      .post(`/api/v1/orders/${orderId}/payment/verify`)
      .set("Authorization", `Bearer ${manager.accessToken}`)
      .send({ paymentMethod: PaymentMethod.CASH })
      .expect(409);

    await request(app)
      .post(`/api/v1/orders/${orderId}/confirm`)
      .set("Authorization", `Bearer ${manager.accessToken}`)
      .expect(200);
    await request(app)
      .post(`/api/v1/orders/${orderId}/confirm`)
      .set("Authorization", `Bearer ${manager.accessToken}`)
      .expect(409);
    await request(app)
      .post(`/api/v1/orders/${orderId}/fulfill`)
      .set("Authorization", `Bearer ${manager.accessToken}`)
      .expect(409);
    await request(app)
      .post(`/api/v1/orders/${orderId}/payment/verify`)
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .send({ paymentMethod: PaymentMethod.OTHER })
      .expect(200);
    await request(app)
      .post(`/api/v1/orders/${orderId}/cancel`)
      .set("Authorization", `Bearer ${manager.accessToken}`)
      .send({ reason: "Paid orders need refunds" })
      .expect(409);
    await request(app)
      .post(`/api/v1/orders/${orderId}/fulfill`)
      .set("Authorization", `Bearer ${manager.accessToken}`)
      .expect(200);
    await request(app)
      .post(`/api/v1/orders/${orderId}/cancel`)
      .set("Authorization", `Bearer ${manager.accessToken}`)
      .send({ reason: "Too late" })
      .expect(409);
    await request(app)
      .post(`/api/v1/orders/${orderId}/fulfill`)
      .set("Authorization", `Bearer ${manager.accessToken}`)
      .expect(409);

    const cancelledOrder = await request(app)
      .post("/api/v1/orders")
      .set("Authorization", `Bearer ${customer.accessToken}`)
      .send({ items: [{ productId: product.id, quantity: 1 }] })
      .expect(201);
    await request(app)
      .post(`/api/v1/orders/${cancelledOrder.body.data.id}/cancel`)
      .set("Authorization", `Bearer ${customer.accessToken}`)
      .send({ reason: "Changed plans" })
      .expect(200);
    await request(app)
      .post(`/api/v1/orders/${cancelledOrder.body.data.id}/confirm`)
      .set("Authorization", `Bearer ${manager.accessToken}`)
      .expect(409);
    await request(app)
      .post(`/api/v1/orders/${cancelledOrder.body.data.id}/payment/verify`)
      .set("Authorization", `Bearer ${manager.accessToken}`)
      .send({ paymentMethod: PaymentMethod.CASH })
      .expect(409);
    await request(app)
      .post(`/api/v1/orders/${cancelledOrder.body.data.id}/fulfill`)
      .set("Authorization", `Bearer ${manager.accessToken}`)
      .expect(409);
  });

  it("preserves historical order pricing when the product price changes before fulfillment", async () => {
    const { manager } = await createManagementSessions(app);
    const customer = await registerCustomer(app);
    const product = await createProductThroughApi(app, manager, {
      name: "E2E Historical Price Drink",
      sellingPrice: 130,
      costPrice: 80,
    });
    await receiveStockThroughApi(app, manager, product.id, 4);
    const orderId = await createReadyOrder({
      app,
      manager,
      customer,
      productId: product.id,
      quantity: 2,
      paymentMethod: PaymentMethod.TRANSFER,
    });

    await prisma.product.update({
      where: { id: product.id },
      data: {
        sellingPrice: new Prisma.Decimal(200),
        costPrice: new Prisma.Decimal(90),
      },
    });

    await request(app)
      .post(`/api/v1/orders/${orderId}/fulfill`)
      .set("Authorization", `Bearer ${manager.accessToken}`)
      .expect(200);

    const orderItem = await prisma.orderItem.findFirstOrThrow({
      where: { orderId },
    });
    const sale = await prisma.sale.findUniqueOrThrow({
      where: { orderId },
      include: { items: true },
    });
    expect(Number(orderItem.unitPrice)).toBe(130);
    expect(Number(sale.items[0].unitPrice)).toBe(130);
    expect(Number(sale.items[0].lineTotal)).toBe(260);
    expect(Number(sale.subtotal)).toBe(260);
    expect(Number(sale.items[0].unitCost)).toBe(90);
    expect(Number(sale.totalCost)).toBe(180);
    expect(Number(sale.grossProfit)).toBe(80);
  });

  it("covers cancellation notifications and terminal cancellation behavior", async () => {
    const { manager } = await createManagementSessions(app);
    const customer = await registerCustomer(app);
    const product = await createProductThroughApi(app, manager);
    await receiveStockThroughApi(app, manager, product.id, 2);

    const orderResponse = await request(app)
      .post("/api/v1/orders")
      .set("Authorization", `Bearer ${customer.accessToken}`)
      .send({ items: [{ productId: product.id, quantity: 1 }] })
      .expect(201);
    notificationProvider.clear();

    const cancelled = await request(app)
      .post(`/api/v1/orders/${orderResponse.body.data.id}/cancel`)
      .set("Authorization", `Bearer ${customer.accessToken}`)
      .send({ reason: "No longer needed" })
      .expect(200);
    expect(cancelled.body.data).toMatchObject({
      status: OrderStatus.CANCELLED,
      cancelReason: "No longer needed",
    });
    expect(cancelled.body.data.cancelledAt).toEqual(expect.any(String));
    expectCustomerSafeOrderPayload(cancelled.body.data);
    expect(notificationTypes(notificationProvider)).toEqual([
      notificationEventTypes.ORDER_CANCELLED,
    ]);

    await request(app)
      .post(`/api/v1/orders/${orderResponse.body.data.id}/confirm`)
      .set("Authorization", `Bearer ${manager.accessToken}`)
      .expect(409);
    await request(app)
      .post(`/api/v1/orders/${orderResponse.body.data.id}/payment/verify`)
      .set("Authorization", `Bearer ${manager.accessToken}`)
      .send({ paymentMethod: PaymentMethod.CASH })
      .expect(409);
    await request(app)
      .post(`/api/v1/orders/${orderResponse.body.data.id}/fulfill`)
      .set("Authorization", `Bearer ${manager.accessToken}`)
      .expect(409);
  });

  it("covers authentication session behavior over HTTP", async () => {
    const admin = await createUser(UserRole.ADMIN, "auth-admin");

    await request(app).get("/api/v1/auth/me").expect(401);
    await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", "Bearer not-a-real-token")
      .expect(401);

    const session = await login(app, admin);
    await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${session.accessToken}`)
      .expect(200);

    await request(app)
      .post("/api/v1/auth/refresh")
      .send({ refreshToken: "client-body-token-is-ignored" })
      .expect(401);

    const refreshed = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", session.cookie)
      .set("Origin", process.env.CORS_ORIGIN ?? "http://localhost:5173")
      .expect(200);
    expect(refreshed.body.data.accessToken).toEqual(expect.any(String));
    expect(refreshed.body.data.refreshToken).toBeUndefined();
    const refreshedSetCookie = normalizeSetCookieHeader(
      refreshed.headers["set-cookie"],
    );
    const refreshedCookieText = refreshedSetCookie.join("; ");
    expect(refreshedCookieText).toContain("md_refresh_token=");
    expect(refreshedCookieText).toContain("HttpOnly");
    const refreshedCookie = refreshedSetCookie
      .map((cookie) => cookie.split(";")[0])
      .join("; ");

    await request(app)
      .post("/api/v1/auth/logout")
      .set("Cookie", refreshedCookie)
      .set("Origin", process.env.CORS_ORIGIN ?? "http://localhost:5173")
      .expect(204);
    await request(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", refreshedCookie)
      .set("Origin", process.env.CORS_ORIGIN ?? "http://localhost:5173")
      .expect(401);
  });
});
