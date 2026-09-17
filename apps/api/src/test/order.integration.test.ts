import crypto from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  OrderStatus,
  Prisma,
  ProductCategory,
  ProductUnit,
  UserRole,
} from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { OrderService } from "../services/order.service.js";

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
  await prisma.order.deleteMany({
    where: { customer: { email: { endsWith: `@${testEmailDomain}` } } },
  });
  await prisma.product.deleteMany({
    where: { sku: { startsWith: testSkuPrefix } },
  });
  await prisma.user.deleteMany({
    where: { email: { endsWith: `@${testEmailDomain}` } },
  });
}

async function createCustomer() {
  return prisma.user.create({
    data: {
      email: `order-${crypto.randomUUID()}@${testEmailDomain}`,
      name: "Order Integration Customer",
      passwordHash: "hashed",
      role: UserRole.CUSTOMER,
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
});
