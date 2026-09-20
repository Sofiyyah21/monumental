import { describe, expect, it } from "vitest";
import {
  OrderPaymentStatus,
  OrderStatus,
  PaymentMethod,
  Prisma,
  ProductCategory,
  ProductUnit,
  UserRole,
} from "@prisma/client";
import type { DatabaseClient } from "../lib/database.js";
import {
  createNotificationService,
  InMemoryNotificationProvider,
  notificationEventTypes,
} from "../services/notification.service.js";
import { OrderService } from "../services/order.service.js";
import { createFakeDatabase } from "./fake-db.js";

let userSequence = 1;
let productSequence = 1;

function createNotificationTestContext() {
  const fake = createFakeDatabase();
  const notificationProvider = new InMemoryNotificationProvider();
  const orderService = new OrderService(
    fake.db,
    createNotificationService(notificationProvider),
  );

  return { ...fake, notificationProvider, orderService };
}

async function createUser(db: DatabaseClient, role: UserRole) {
  const userNumber = userSequence;
  userSequence += 1;

  return db.user.create({
    data: {
      email: `${role.toLowerCase()}-${userNumber}@notifications.test`,
      name: `${role} Notifications`,
      passwordHash: "hashed",
      role,
    },
  });
}

async function createProduct(
  db: DatabaseClient,
  input: { stock?: number; sellingPrice?: number; costPrice?: number } = {},
) {
  const productNumber = productSequence;
  productSequence += 1;

  const product = await db.product.create({
    data: {
      name: `Notification Product ${productNumber}`,
      sku: `NOTICE-${productNumber}`,
      category: ProductCategory.DRINKS,
      unit: ProductUnit.PACK,
      costPrice: input.costPrice ?? 100,
      sellingPrice: input.sellingPrice ?? 150,
      reorderLevel: 2,
    },
  });

  return db.product.update({
    where: { id: product.id },
    data: { currentStock: new Prisma.Decimal(input.stock ?? 10) },
  });
}

async function createPendingOrder(input: {
  db: DatabaseClient;
  orderService: OrderService;
  customerId: string;
  quantity?: number;
  stock?: number;
}) {
  const product = await createProduct(input.db, { stock: input.stock ?? 10 });
  const order = await input.orderService.create({
    customerId: input.customerId,
    requesterRole: UserRole.CUSTOMER,
    items: [{ productId: product.id, quantity: input.quantity ?? 1 }],
  });

  return { order, product };
}

describe("notification foundation", () => {
  it("emits ORDER_CREATED only after successful order creation", async () => {
    const { db, notificationProvider, orderService } =
      createNotificationTestContext();
    const customer = await createUser(db, UserRole.CUSTOMER);
    const product = await createProduct(db, { stock: 4 });

    const order = await orderService.create({
      customerId: customer.id,
      requesterRole: UserRole.CUSTOMER,
      items: [{ productId: product.id, quantity: 2 }],
    });

    expect(notificationProvider.events).toEqual([
      expect.objectContaining({
        eventId: `${notificationEventTypes.ORDER_CREATED}:${order.id}`,
        type: notificationEventTypes.ORDER_CREATED,
        orderId: order.id,
        customerId: customer.id,
        orderReference: order.reference,
        orderStatus: OrderStatus.PENDING,
        paymentStatus: OrderPaymentStatus.UNPAID,
      }),
    ]);

    notificationProvider.clear();
    await expect(
      orderService.create({
        customerId: customer.id,
        requesterRole: UserRole.CUSTOMER,
        items: [{ productId: product.id, quantity: 20 }],
      }),
    ).rejects.toMatchObject({ code: "PRODUCT_UNAVAILABLE" });
    expect(notificationProvider.events).toHaveLength(0);
  });

  it("emits ORDER_CONFIRMED after confirmation and not on rejected transitions", async () => {
    const { db, notificationProvider, orderService } =
      createNotificationTestContext();
    const customer = await createUser(db, UserRole.CUSTOMER);
    const manager = await createUser(db, UserRole.MANAGER);
    const { order } = await createPendingOrder({
      db,
      orderService,
      customerId: customer.id,
    });

    notificationProvider.clear();
    const confirmed = await orderService.confirm({
      orderId: order.id,
      requesterId: manager.id,
      requesterRole: UserRole.MANAGER,
    });

    expect(notificationProvider.events).toEqual([
      expect.objectContaining({
        eventId: `${notificationEventTypes.ORDER_CONFIRMED}:${order.id}`,
        type: notificationEventTypes.ORDER_CONFIRMED,
        orderStatus: OrderStatus.CONFIRMED,
      }),
    ]);
    expect(confirmed.status).toBe(OrderStatus.CONFIRMED);

    notificationProvider.clear();
    await expect(
      orderService.confirm({
        orderId: order.id,
        requesterId: manager.id,
        requesterRole: UserRole.MANAGER,
      }),
    ).rejects.toMatchObject({ code: "ORDER_NOT_CONFIRMABLE" });
    expect(notificationProvider.events).toHaveLength(0);
  });

  it("emits PAYMENT_VERIFIED with the persisted payment method only after successful verification", async () => {
    const { db, notificationProvider, orderService } =
      createNotificationTestContext();
    const customer = await createUser(db, UserRole.CUSTOMER);
    const manager = await createUser(db, UserRole.MANAGER);
    const { order } = await createPendingOrder({
      db,
      orderService,
      customerId: customer.id,
    });

    notificationProvider.clear();
    await expect(
      orderService.verifyPayment({
        orderId: order.id,
        requesterId: manager.id,
        requesterRole: UserRole.MANAGER,
        paymentMethod: PaymentMethod.TRANSFER,
      }),
    ).rejects.toMatchObject({ code: "ORDER_PAYMENT_NOT_VERIFIABLE" });
    expect(notificationProvider.events).toHaveLength(0);

    await orderService.confirm({
      orderId: order.id,
      requesterId: manager.id,
      requesterRole: UserRole.MANAGER,
    });

    notificationProvider.clear();
    const paid = await orderService.verifyPayment({
      orderId: order.id,
      requesterId: manager.id,
      requesterRole: UserRole.MANAGER,
      paymentMethod: PaymentMethod.TRANSFER,
    });

    expect(paid.paymentMethod).toBe(PaymentMethod.TRANSFER);
    expect(notificationProvider.events).toEqual([
      expect.objectContaining({
        eventId: `${notificationEventTypes.PAYMENT_VERIFIED}:${order.id}`,
        type: notificationEventTypes.PAYMENT_VERIFIED,
        paymentStatus: OrderPaymentStatus.PAID,
        paymentMethod: PaymentMethod.TRANSFER,
      }),
    ]);

    notificationProvider.clear();
    await expect(
      orderService.verifyPayment({
        orderId: order.id,
        requesterId: manager.id,
        requesterRole: UserRole.MANAGER,
        paymentMethod: PaymentMethod.TRANSFER,
      }),
    ).rejects.toMatchObject({ code: "ORDER_PAYMENT_ALREADY_PROCESSED" });
    expect(notificationProvider.events).toHaveLength(0);
  });

  it("emits ORDER_FULFILLED only after successful fulfillment", async () => {
    const { db, notificationProvider, orderService, sales, stockMovements } =
      createNotificationTestContext();
    const customer = await createUser(db, UserRole.CUSTOMER);
    const manager = await createUser(db, UserRole.MANAGER);
    const { order, product } = await createPendingOrder({
      db,
      orderService,
      customerId: customer.id,
      quantity: 2,
      stock: 2,
    });

    await orderService.confirm({
      orderId: order.id,
      requesterId: manager.id,
      requesterRole: UserRole.MANAGER,
    });
    await orderService.verifyPayment({
      orderId: order.id,
      requesterId: manager.id,
      requesterRole: UserRole.MANAGER,
      paymentMethod: PaymentMethod.CASH,
    });

    await db.product.update({
      where: { id: product.id },
      data: { currentStock: new Prisma.Decimal(1) },
    });

    notificationProvider.clear();
    await expect(
      orderService.fulfill({
        orderId: order.id,
        requesterId: manager.id,
        requesterRole: UserRole.MANAGER,
      }),
    ).rejects.toMatchObject({ code: "INSUFFICIENT_STOCK" });
    expect(notificationProvider.events).toHaveLength(0);
    expect(sales.size).toBe(0);
    expect(stockMovements.size).toBe(0);

    await db.product.update({
      where: { id: product.id },
      data: { currentStock: new Prisma.Decimal(2) },
    });

    const fulfilled = await orderService.fulfill({
      orderId: order.id,
      requesterId: manager.id,
      requesterRole: UserRole.MANAGER,
    });

    expect(fulfilled.status).toBe(OrderStatus.FULFILLED);
    expect(notificationProvider.events).toEqual([
      expect.objectContaining({
        eventId: `${notificationEventTypes.ORDER_FULFILLED}:${order.id}`,
        type: notificationEventTypes.ORDER_FULFILLED,
        orderStatus: OrderStatus.FULFILLED,
        paymentStatus: OrderPaymentStatus.PAID,
        paymentMethod: PaymentMethod.CASH,
      }),
    ]);

    notificationProvider.clear();
    await expect(
      orderService.fulfill({
        orderId: order.id,
        requesterId: manager.id,
        requesterRole: UserRole.MANAGER,
      }),
    ).rejects.toMatchObject({ code: "ORDER_NOT_FULFILLABLE" });
    expect(notificationProvider.events).toHaveLength(0);
  });

  it("emits ORDER_CANCELLED after successful cancellation and keeps paid-order cancellation blocked", async () => {
    const { db, notificationProvider, orderService } =
      createNotificationTestContext();
    const customer = await createUser(db, UserRole.CUSTOMER);
    const manager = await createUser(db, UserRole.MANAGER);
    const cancellable = await createPendingOrder({
      db,
      orderService,
      customerId: customer.id,
    });

    notificationProvider.clear();
    const cancelled = await orderService.cancel({
      orderId: cancellable.order.id,
      requesterId: customer.id,
      requesterRole: UserRole.CUSTOMER,
      reason: "Changed plans",
    });

    expect(cancelled.status).toBe(OrderStatus.CANCELLED);
    expect(notificationProvider.events).toEqual([
      expect.objectContaining({
        eventId: `${notificationEventTypes.ORDER_CANCELLED}:${cancellable.order.id}`,
        type: notificationEventTypes.ORDER_CANCELLED,
        orderStatus: OrderStatus.CANCELLED,
      }),
    ]);

    notificationProvider.clear();
    await expect(
      orderService.cancel({
        orderId: cancellable.order.id,
        requesterId: customer.id,
        requesterRole: UserRole.CUSTOMER,
        reason: "Again",
      }),
    ).rejects.toMatchObject({ code: "ORDER_ALREADY_CANCELLED" });
    expect(notificationProvider.events).toHaveLength(0);

    const paidOrder = await createPendingOrder({
      db,
      orderService,
      customerId: customer.id,
    });
    await orderService.confirm({
      orderId: paidOrder.order.id,
      requesterId: manager.id,
      requesterRole: UserRole.MANAGER,
    });
    await orderService.verifyPayment({
      orderId: paidOrder.order.id,
      requesterId: manager.id,
      requesterRole: UserRole.MANAGER,
      paymentMethod: PaymentMethod.CARD,
    });

    notificationProvider.clear();
    await expect(
      orderService.cancel({
        orderId: paidOrder.order.id,
        requesterId: manager.id,
        requesterRole: UserRole.MANAGER,
        reason: "Needs refund",
      }),
    ).rejects.toMatchObject({ code: "ORDER_PAID_NOT_CANCELLABLE" });
    expect(notificationProvider.events).toHaveLength(0);
  });

  it("keeps notification payloads customer-safe and free of internal financial/audit data", async () => {
    const { db, notificationProvider, orderService } =
      createNotificationTestContext();
    const customer = await createUser(db, UserRole.CUSTOMER);
    const manager = await createUser(db, UserRole.MANAGER);
    const { order } = await createPendingOrder({
      db,
      orderService,
      customerId: customer.id,
    });

    await orderService.confirm({
      orderId: order.id,
      requesterId: manager.id,
      requesterRole: UserRole.MANAGER,
    });
    await orderService.verifyPayment({
      orderId: order.id,
      requesterId: manager.id,
      requesterRole: UserRole.MANAGER,
      paymentMethod: PaymentMethod.OTHER,
    });

    for (const event of notificationProvider.events) {
      expect(event).not.toHaveProperty("password");
      expect(event).not.toHaveProperty("accessToken");
      expect(event).not.toHaveProperty("refreshToken");
      expect(event).not.toHaveProperty("costPrice");
      expect(event).not.toHaveProperty("unitCost");
      expect(event).not.toHaveProperty("cogs");
      expect(event).not.toHaveProperty("grossProfit");
      expect(event).not.toHaveProperty("currentStock");
      expect(event).not.toHaveProperty("paidById");
      expect(event).not.toHaveProperty("confirmedById");
      expect(event).not.toHaveProperty("fulfilledById");
      expect(event).not.toHaveProperty("voidedById");
    }
  });
});
