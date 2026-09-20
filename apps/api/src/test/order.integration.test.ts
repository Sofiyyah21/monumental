import crypto from "node:crypto";
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
import { prisma } from "../lib/prisma.js";
import { OrderService } from "../services/order.service.js";
import { ReportService } from "../services/report.service.js";

const runDatabaseTests = process.env.RUN_DATABASE_TESTS === "true";
const describeDatabase = runDatabaseTests ? describe : describe.skip;
const testSkuPrefix = "ORDER-INTEGRATION";
const testEmailDomain = "order-integration.test";

function assertSafeTestDatabase() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required for order integration tests.");
  }

  const databaseName = new URL(databaseUrl).pathname.replace("/", "");
  if (!databaseName.toLowerCase().includes("test")) {
    throw new Error(
      "Order integration tests require a dedicated test database name containing 'test'.",
    );
  }
}

function uniqueSku(prefix: string) {
  return `${testSkuPrefix}-${prefix}-${crypto.randomUUID()}`.toUpperCase();
}

async function cleanupIntegrationOrders() {
  await prisma.stockMovement.deleteMany({
    where: {
      OR: [
        { product: { sku: { startsWith: testSkuPrefix } } },
        { createdBy: { email: { endsWith: `@${testEmailDomain}` } } },
      ],
    },
  });

  await prisma.sale.deleteMany({
    where: {
      seller: {
        email: { endsWith: `@${testEmailDomain}` },
      },
    },
  });

  await prisma.order.deleteMany({
    where: {
      customer: {
        email: { endsWith: `@${testEmailDomain}` },
      },
    },
  });

  await prisma.product.deleteMany({
    where: {
      sku: { startsWith: testSkuPrefix },
    },
  });

  await prisma.user.deleteMany({
    where: {
      email: { endsWith: `@${testEmailDomain}` },
    },
  });
}

async function createCustomer() {
  return createUser(UserRole.CUSTOMER);
}

async function createUser(role: UserRole) {
  return prisma.user.create({
    data: {
      email: `${role.toLowerCase()}-${crypto.randomUUID()}@${testEmailDomain}`,
      name: `Order Integration ${role}`,
      passwordHash: "hashed",
      role,
    },
  });
}

async function createProduct(input: {
  stock: number;
  sellingPrice?: number;
  name?: string;
}) {
  return prisma.product.create({
    data: {
      name: input.name ?? `Order Integration Product ${crypto.randomUUID()}`,
      sku: uniqueSku("PRODUCT"),
      category: ProductCategory.DRINKS,
      unit: ProductUnit.PACK,
      costPrice: new Prisma.Decimal(100),
      sellingPrice: new Prisma.Decimal(input.sellingPrice ?? 150),
      currentStock: new Prisma.Decimal(input.stock),
      reorderLevel: new Prisma.Decimal(2),
    },
  });
}

describeDatabase("database-backed customer order integration", () => {
  const orderService = new OrderService(prisma);
  const reportService = new ReportService(prisma);

  beforeAll(async () => {
    assertSafeTestDatabase();
    await prisma.$connect();
    await cleanupIntegrationOrders();
  });

  beforeEach(async () => {
    await cleanupIntegrationOrders();
  });

  afterAll(async () => {
    await cleanupIntegrationOrders();
    await prisma.$disconnect();
  });

  it("creates orders with snapshots and leaves inventory unreserved", async () => {
    const customer = await createCustomer();
    const product = await createProduct({
      name: "Integration Customer Drink",
      stock: 5,
      sellingPrice: 125,
    });

    const order = await orderService.create({
      customerId: customer.id,
      requesterRole: UserRole.CUSTOMER,
      items: [{ productId: product.id, quantity: 2 }],
    });

    expect(order.reference).toMatch(/^MD-ORD-\d{8}-\d{5}$/);
    expect(order.status).toBe(OrderStatus.PENDING);
    expect(order.subtotal.toNumber()).toBe(250);
    expect(order.items[0]).toMatchObject({
      productId: product.id,
      productName: "Integration Customer Drink",
      productSku: product.sku,
      productUnit: ProductUnit.PACK,
    });
    expect(order.items[0]?.unitPrice.toNumber()).toBe(125);

    await prisma.product.update({
      where: { id: product.id },
      data: { name: "Renamed Integration Drink", sellingPrice: 200 },
    });

    const storedOrder = await orderService.getById({
      orderId: order.id,
      requesterId: customer.id,
      requesterRole: UserRole.CUSTOMER,
    });
    const storedProduct = await prisma.product.findUniqueOrThrow({
      where: { id: product.id },
    });
    const movementCount = await prisma.stockMovement.count({
      where: { productId: product.id },
    });

    expect(storedOrder.items[0]?.productName).toBe(
      "Integration Customer Drink",
    );
    expect(storedOrder.items[0]?.unitPrice.toNumber()).toBe(125);
    expect(storedProduct.currentStock.toNumber()).toBe(5);
    expect(movementCount).toBe(0);
  });

  it("rolls back orders and items when creation validation fails", async () => {
    const customer = await createCustomer();
    const product = await createProduct({ stock: 1 });

    await expect(
      orderService.create({
        customerId: customer.id,
        requesterRole: UserRole.CUSTOMER,
        items: [
          { productId: product.id, quantity: 1 },
          { productId: "missing-product", quantity: 1 },
        ],
      }),
    ).rejects.toMatchObject({ statusCode: 404, code: "PRODUCT_NOT_FOUND" });

    const orderCount = await prisma.order.count({
      where: { customerId: customer.id },
    });
    const itemCount = await prisma.orderItem.count({
      where: { order: { customerId: customer.id } },
    });
    const storedProduct = await prisma.product.findUniqueOrThrow({
      where: { id: product.id },
    });

    expect(orderCount).toBe(0);
    expect(itemCount).toBe(0);
    expect(storedProduct.currentStock.toNumber()).toBe(1);
  });

  it("finalizes confirmed paid orders into sales, sale items, and SOLD movements", async () => {
    const customer = await createCustomer();
    const manager = await createUser(UserRole.MANAGER);
    const product = await createProduct({ stock: 5 });

    const order = await orderService.create({
      customerId: customer.id,
      requesterRole: UserRole.CUSTOMER,
      items: [{ productId: product.id, quantity: 2 }],
    });

    const confirmed = await orderService.confirm({
      orderId: order.id,
      requesterId: manager.id,
      requesterRole: UserRole.MANAGER,
    });

    expect(confirmed.status).toBe(OrderStatus.CONFIRMED);
    expect(confirmed.confirmedById).toBe(manager.id);
    expect(confirmed.confirmedAt).toBeInstanceOf(Date);

    const paid = await orderService.verifyPayment({
      orderId: order.id,
      paymentMethod: PaymentMethod.TRANSFER,
      requesterId: manager.id,
      requesterRole: UserRole.MANAGER,
    });

    expect(paid.status).toBe(OrderStatus.CONFIRMED);
    expect(paid.paymentStatus).toBe(OrderPaymentStatus.PAID);
    expect(paid.paymentMethod).toBe(PaymentMethod.TRANSFER);
    expect(paid.paidById).toBe(manager.id);
    expect(paid.paidAt).toBeInstanceOf(Date);

    const fulfilled = await orderService.fulfill({
      orderId: order.id,
      requesterId: manager.id,
      requesterRole: UserRole.MANAGER,
    });

    expect(fulfilled.status).toBe(OrderStatus.FULFILLED);
    expect(fulfilled.fulfilledById).toBe(manager.id);
    expect(fulfilled.fulfilledAt).toBeInstanceOf(Date);

    const storedProduct = await prisma.product.findUniqueOrThrow({
      where: { id: product.id },
    });
    const sale = await prisma.sale.findUniqueOrThrow({
      where: { orderId: order.id },
      include: { items: true, stockMovements: true },
    });

    expect(storedProduct.currentStock.toNumber()).toBe(3);
    expect(sale.reference).toMatch(/^MD-\d{8}-\d{5}$/);
    expect(sale).toMatchObject({
      orderId: order.id,
      sellerId: manager.id,
      customerId: customer.id,
      paymentMethod: PaymentMethod.TRANSFER,
      paymentStatus: PaymentStatus.PAID,
      status: "COMPLETED",
    });
    expect(sale.subtotal.toNumber()).toBe(300);
    expect(sale.totalAmount.toNumber()).toBe(300);
    expect(sale.totalCost.toNumber()).toBe(200);
    expect(sale.grossProfit.toNumber()).toBe(100);
    expect(sale.items).toHaveLength(1);
    expect(sale.items[0]).toMatchObject({
      productId: product.id,
      productName: product.name,
      productUnit: product.unit,
    });
    expect(sale.items[0]?.quantity.toNumber()).toBe(2);
    expect(sale.items[0]?.unitPrice.toNumber()).toBe(150);
    expect(sale.items[0]?.unitCost.toNumber()).toBe(100);
    expect(sale.stockMovements).toHaveLength(1);
    expect(sale.stockMovements[0]).toMatchObject({
      type: StockMovementType.SOLD,
      reference: sale.reference,
      createdById: manager.id,
    });
    expect(sale.stockMovements[0]?.previousStock.toNumber()).toBe(5);
    expect(sale.stockMovements[0]?.newStock.toNumber()).toBe(3);

    await expect(
      orderService.fulfill({
        orderId: order.id,
        requesterId: manager.id,
        requesterRole: UserRole.MANAGER,
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(await prisma.sale.count({ where: { orderId: order.id } })).toBe(1);
  });

  it("rolls back fulfillment when stock is no longer sufficient", async () => {
    const customer = await createCustomer();
    const manager = await createUser(UserRole.MANAGER);
    const product = await createProduct({ stock: 2 });

    const order = await orderService.create({
      customerId: customer.id,
      requesterRole: UserRole.CUSTOMER,
      items: [{ productId: product.id, quantity: 2 }],
    });
    await orderService.confirm({
      orderId: order.id,
      requesterId: manager.id,
      requesterRole: UserRole.MANAGER,
    });
    await orderService.verifyPayment({
      orderId: order.id,
      paymentMethod: PaymentMethod.CASH,
      requesterId: manager.id,
      requesterRole: UserRole.MANAGER,
    });
    await prisma.product.update({
      where: { id: product.id },
      data: { currentStock: new Prisma.Decimal(1) },
    });

    await expect(
      orderService.fulfill({
        orderId: order.id,
        requesterId: manager.id,
        requesterRole: UserRole.MANAGER,
      }),
    ).rejects.toMatchObject({ statusCode: 409, code: "INSUFFICIENT_STOCK" });

    const storedOrder = await prisma.order.findUniqueOrThrow({
      where: { id: order.id },
    });
    const storedProduct = await prisma.product.findUniqueOrThrow({
      where: { id: product.id },
    });
    expect(storedOrder.status).toBe(OrderStatus.CONFIRMED);
    expect(storedOrder.paymentStatus).toBe(OrderPaymentStatus.PAID);
    expect(storedOrder.fulfilledAt).toBeNull();
    expect(storedProduct.currentStock.toNumber()).toBe(1);
    expect(await prisma.sale.count({ where: { orderId: order.id } })).toBe(0);
    expect(
      await prisma.stockMovement.count({ where: { productId: product.id } }),
    ).toBe(0);
  });

  it("uses order price snapshots, current product cost, and completed sale reporting", async () => {
    const customer = await createCustomer();
    const manager = await createUser(UserRole.MANAGER);
    const product = await createProduct({
      name: "Snapshot Fulfillment Drink",
      stock: 5,
      sellingPrice: 125,
    });

    const order = await orderService.create({
      customerId: customer.id,
      requesterRole: UserRole.CUSTOMER,
      items: [{ productId: product.id, quantity: 2 }],
    });

    await prisma.product.update({
      where: { id: product.id },
      data: {
        name: "Renamed Fulfillment Drink",
        sellingPrice: new Prisma.Decimal(200),
        costPrice: new Prisma.Decimal(80),
      },
    });
    await orderService.confirm({
      orderId: order.id,
      requesterId: manager.id,
      requesterRole: UserRole.MANAGER,
    });
    await orderService.verifyPayment({
      orderId: order.id,
      paymentMethod: PaymentMethod.CARD,
      requesterId: manager.id,
      requesterRole: UserRole.MANAGER,
    });
    const fulfilled = await orderService.fulfill({
      orderId: order.id,
      requesterId: manager.id,
      requesterRole: UserRole.MANAGER,
    });

    const sale = await prisma.sale.findUniqueOrThrow({
      where: { orderId: order.id },
      include: { items: true },
    });
    expect(fulfilled.sale?.reference).toBe(sale.reference);
    expect(sale.items[0]?.productName).toBe("Snapshot Fulfillment Drink");
    expect(sale.items[0]?.unitPrice.toNumber()).toBe(125);
    expect(sale.items[0]?.unitCost.toNumber()).toBe(80);
    expect(sale.totalAmount.toNumber()).toBe(250);
    expect(sale.totalCost.toNumber()).toBe(160);
    expect(sale.grossProfit.toNumber()).toBe(90);

    const from = new Date(sale.soldAt.getTime() - 1000).toISOString();
    const to = new Date(sale.soldAt.getTime() + 1000).toISOString();
    const summary = await reportService.getCustomSalesSummary({ from, to });
    const bestSellers = await reportService.getBestSellers({ from, to });
    expect(summary.salesCount).toBe(1);
    expect(summary.unitsSold.toNumber()).toBe(2);
    expect(summary.revenue.toNumber()).toBe(250);
    expect(summary.cogs.toNumber()).toBe(160);
    expect(summary.grossProfit.toNumber()).toBe(90);
    expect(bestSellers.products[0]).toMatchObject({
      productId: product.id,
      productName: "Snapshot Fulfillment Drink",
    });
    expect(bestSellers.products[0]?.quantitySold.toNumber()).toBe(2);
  });

  it("cancels confirmed orders with actor audit metadata and no inventory restoration", async () => {
    const customer = await createCustomer();
    const manager = await createUser(UserRole.MANAGER);
    const product = await createProduct({ stock: 4 });

    const order = await orderService.create({
      customerId: customer.id,
      requesterRole: UserRole.CUSTOMER,
      items: [{ productId: product.id, quantity: 1 }],
    });

    await orderService.confirm({
      orderId: order.id,
      requesterId: manager.id,
      requesterRole: UserRole.MANAGER,
    });

    const cancelled = await orderService.cancel({
      orderId: order.id,
      requesterId: manager.id,
      requesterRole: UserRole.MANAGER,
      reason: "Customer order cannot be supplied",
    });

    expect(cancelled.status).toBe(OrderStatus.CANCELLED);
    expect(cancelled.cancelledById).toBe(manager.id);
    expect(cancelled.cancelledAt).toBeInstanceOf(Date);
    expect(cancelled.cancelReason).toBe("Customer order cannot be supplied");

    const storedProduct = await prisma.product.findUniqueOrThrow({
      where: { id: product.id },
    });
    expect(storedProduct.currentStock.toNumber()).toBe(4);
    expect(
      await prisma.stockMovement.count({ where: { productId: product.id } }),
    ).toBe(0);
    expect(await prisma.sale.count()).toBe(0);
  });

  it("verifies confirmed unpaid orders with payment audit metadata and no side effects", async () => {
    const customer = await createCustomer();
    const manager = await createUser(UserRole.MANAGER);
    const product = await createProduct({ stock: 5 });

    const order = await orderService.create({
      customerId: customer.id,
      requesterRole: UserRole.CUSTOMER,
      items: [{ productId: product.id, quantity: 2 }],
    });
    await orderService.confirm({
      orderId: order.id,
      requesterId: manager.id,
      requesterRole: UserRole.MANAGER,
    });

    const paidOrder = await orderService.verifyPayment({
      orderId: order.id,
      paymentMethod: PaymentMethod.CASH,
      requesterId: manager.id,
      requesterRole: UserRole.MANAGER,
    });

    expect(paidOrder.status).toBe(OrderStatus.CONFIRMED);
    expect(paidOrder.paymentStatus).toBe(OrderPaymentStatus.PAID);
    expect(paidOrder.paymentMethod).toBe(PaymentMethod.CASH);
    expect(paidOrder.paidById).toBe(manager.id);
    expect(paidOrder.paidAt).toBeInstanceOf(Date);

    await expect(
      orderService.verifyPayment({
        orderId: order.id,
        paymentMethod: PaymentMethod.CASH,
        requesterId: manager.id,
        requesterRole: UserRole.MANAGER,
      }),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: "ORDER_PAYMENT_ALREADY_PROCESSED",
    });
    await expect(
      orderService.cancel({
        orderId: order.id,
        requesterId: manager.id,
        requesterRole: UserRole.MANAGER,
        reason: "No refund workflow",
      }),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: "ORDER_PAID_NOT_CANCELLABLE",
    });

    const storedProduct = await prisma.product.findUniqueOrThrow({
      where: { id: product.id },
    });
    expect(storedProduct.currentStock.toNumber()).toBe(5);
    expect(
      await prisma.stockMovement.count({ where: { productId: product.id } }),
    ).toBe(0);
    expect(await prisma.sale.count()).toBe(0);
  });

  it("rejects invalid lifecycle transitions and management authorization gaps", async () => {
    const customer = await createCustomer();
    const staff = await createUser(UserRole.STAFF);
    const manager = await createUser(UserRole.MANAGER);
    const product = await createProduct({ stock: 4 });

    const order = await orderService.create({
      customerId: customer.id,
      requesterRole: UserRole.CUSTOMER,
      items: [{ productId: product.id, quantity: 1 }],
    });

    await expect(
      orderService.confirm({
        orderId: order.id,
        requesterId: customer.id,
        requesterRole: UserRole.CUSTOMER,
      }),
    ).rejects.toMatchObject({ statusCode: 403, code: "FORBIDDEN" });
    await expect(
      orderService.fulfill({
        orderId: order.id,
        requesterId: staff.id,
        requesterRole: UserRole.STAFF,
      }),
    ).rejects.toMatchObject({ statusCode: 403, code: "FORBIDDEN" });
    await expect(
      orderService.fulfill({
        orderId: order.id,
        requesterId: manager.id,
        requesterRole: UserRole.MANAGER,
      }),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: "ORDER_NOT_FULFILLABLE",
    });
  });

  it("prevents concurrent lifecycle transitions from producing invalid final states", async () => {
    const customer = await createCustomer();
    const manager = await createUser(UserRole.MANAGER);
    const product = await createProduct({ stock: 6 });

    const order = await orderService.create({
      customerId: customer.id,
      requesterRole: UserRole.CUSTOMER,
      items: [{ productId: product.id, quantity: 1 }],
    });

    const confirmResults = await Promise.allSettled([
      orderService.confirm({
        orderId: order.id,
        requesterId: manager.id,
        requesterRole: UserRole.MANAGER,
      }),
      orderService.confirm({
        orderId: order.id,
        requesterId: manager.id,
        requesterRole: UserRole.MANAGER,
      }),
    ]);

    expect(
      confirmResults.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      confirmResults.filter((result) => result.status === "rejected"),
    ).toHaveLength(1);

    const raceResults = await Promise.allSettled([
      orderService.fulfill({
        orderId: order.id,
        requesterId: manager.id,
        requesterRole: UserRole.MANAGER,
      }),
      orderService.cancel({
        orderId: order.id,
        requesterId: manager.id,
        requesterRole: UserRole.MANAGER,
        reason: "Race cancellation",
      }),
    ]);

    expect(
      raceResults.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      raceResults.filter((result) => result.status === "rejected"),
    ).toHaveLength(1);

    const storedOrder = await prisma.order.findUniqueOrThrow({
      where: { id: order.id },
    });
    expect([OrderStatus.FULFILLED, OrderStatus.CANCELLED]).toContain(
      storedOrder.status,
    );

    const storedProduct = await prisma.product.findUniqueOrThrow({
      where: { id: product.id },
    });
    expect(storedProduct.currentStock.toNumber()).toBe(6);
    expect(
      await prisma.stockMovement.count({ where: { productId: product.id } }),
    ).toBe(0);
    expect(await prisma.sale.count()).toBe(0);
  });

  it("prevents concurrent fulfillment from creating duplicate sales or inventory decrements", async () => {
    const customer = await createCustomer();
    const manager = await createUser(UserRole.MANAGER);
    const admin = await createUser(UserRole.ADMIN);
    const product = await createProduct({ stock: 6 });

    const order = await orderService.create({
      customerId: customer.id,
      requesterRole: UserRole.CUSTOMER,
      items: [{ productId: product.id, quantity: 2 }],
    });
    await orderService.confirm({
      orderId: order.id,
      requesterId: manager.id,
      requesterRole: UserRole.MANAGER,
    });
    await orderService.verifyPayment({
      orderId: order.id,
      paymentMethod: PaymentMethod.TRANSFER,
      requesterId: manager.id,
      requesterRole: UserRole.MANAGER,
    });

    const results = await Promise.allSettled([
      orderService.fulfill({
        orderId: order.id,
        requesterId: manager.id,
        requesterRole: UserRole.MANAGER,
      }),
      orderService.fulfill({
        orderId: order.id,
        requesterId: admin.id,
        requesterRole: UserRole.ADMIN,
      }),
    ]);

    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      results.filter((result) => result.status === "rejected"),
    ).toHaveLength(1);

    const storedOrder = await prisma.order.findUniqueOrThrow({
      where: { id: order.id },
    });
    const storedProduct = await prisma.product.findUniqueOrThrow({
      where: { id: product.id },
    });
    const sale = await prisma.sale.findUniqueOrThrow({
      where: { orderId: order.id },
      include: { items: true, stockMovements: true },
    });

    expect(storedOrder.status).toBe(OrderStatus.FULFILLED);
    expect(storedProduct.currentStock.toNumber()).toBe(4);
    expect(await prisma.sale.count({ where: { orderId: order.id } })).toBe(1);
    expect(sale.items).toHaveLength(1);
    expect(sale.stockMovements).toHaveLength(1);
    expect(sale.stockMovements[0]?.previousStock.toNumber()).toBe(6);
    expect(sale.stockMovements[0]?.newStock.toNumber()).toBe(4);
  });

  it("prevents concurrent payment verification from overwriting the first verifier", async () => {
    const customer = await createCustomer();
    const manager = await createUser(UserRole.MANAGER);
    const admin = await createUser(UserRole.ADMIN);
    const product = await createProduct({ stock: 6 });

    const order = await orderService.create({
      customerId: customer.id,
      requesterRole: UserRole.CUSTOMER,
      items: [{ productId: product.id, quantity: 1 }],
    });
    await orderService.confirm({
      orderId: order.id,
      requesterId: manager.id,
      requesterRole: UserRole.MANAGER,
    });

    const verificationResults = await Promise.allSettled([
      orderService.verifyPayment({
        orderId: order.id,
        paymentMethod: PaymentMethod.TRANSFER,
        requesterId: manager.id,
        requesterRole: UserRole.MANAGER,
      }),
      orderService.verifyPayment({
        orderId: order.id,
        paymentMethod: PaymentMethod.CARD,
        requesterId: admin.id,
        requesterRole: UserRole.ADMIN,
      }),
    ]);

    expect(
      verificationResults.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      verificationResults.filter((result) => result.status === "rejected"),
    ).toHaveLength(1);

    const storedOrder = await prisma.order.findUniqueOrThrow({
      where: { id: order.id },
    });
    expect(storedOrder.paymentStatus).toBe(OrderPaymentStatus.PAID);
    expect(storedOrder.paidAt).toBeInstanceOf(Date);
    expect([manager.id, admin.id]).toContain(storedOrder.paidById);

    const storedProduct = await prisma.product.findUniqueOrThrow({
      where: { id: product.id },
    });
    expect(storedProduct.currentStock.toNumber()).toBe(6);
    expect(
      await prisma.stockMovement.count({ where: { productId: product.id } }),
    ).toBe(0);
    expect(await prisma.sale.count()).toBe(0);
  });
});
