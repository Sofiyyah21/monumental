import {
  OrderPaymentStatus,
  OrderStatus,
  Prisma,
  UserRole,
} from "@prisma/client";
import {
  permissions,
  roleHasPermission,
} from "../authorization/permissions.js";
import { AppError } from "../lib/app-error.js";
import type { DatabaseClient } from "../lib/database.js";
import { inventoryTransactionOptions } from "./inventory.service.js";

type CreateOrderItemInput = {
  productId: string;
  quantity: number;
};

export type CreateOrderInput = {
  customerId: string;
  requesterRole: UserRole;
  items: CreateOrderItemInput[];
};

export type ListOrdersInput = {
  requesterId: string;
  requesterRole: UserRole;
  status?: OrderStatus;
  paymentStatus?: OrderPaymentStatus;
  limit?: number;
};

export type GetOrderInput = {
  orderId: string;
  requesterId: string;
  requesterRole: UserRole;
};

export type CancelOrderInput = GetOrderInput & {
  reason?: string;
};

const orderInclude = {
  items: true,
} satisfies Prisma.OrderInclude;

export class OrderService {
  constructor(private readonly db: DatabaseClient) {}

  async create(input: CreateOrderInput) {
    if (input.requesterRole !== UserRole.CUSTOMER) {
      throw new AppError(
        "Only customers can create customer orders",
        403,
        "CUSTOMER_ORDER_REQUIRED",
      );
    }
    if (input.items.length === 0) {
      throw new AppError(
        "Order must contain at least one item",
        400,
        "EMPTY_ORDER",
      );
    }

    const submittedProductIds = new Set<string>();
    for (const item of input.items) {
      if (submittedProductIds.has(item.productId)) {
        throw new AppError(
          "Duplicate product IDs are not allowed",
          400,
          "DUPLICATE_PRODUCT_ID",
        );
      }
      submittedProductIds.add(item.productId);
      if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
        throw new AppError(
          "Order item quantity must be a positive integer",
          400,
          "INVALID_ORDER_QUANTITY",
        );
      }
    }

    return this.db.$transaction(async (tx) => {
      const now = new Date();
      const productIds = input.items.map((item) => item.productId);
      const sortedProductIds = [...productIds].sort();

      await tx.$queryRaw`
        SELECT "id" FROM "Product"
        WHERE "id" IN (${Prisma.join(sortedProductIds)})
        ORDER BY "id"
        FOR UPDATE
      `;

      const products = await tx.product.findMany({
        where: { id: { in: productIds } },
      });

      if (products.length !== productIds.length) {
        throw new AppError(
          "One or more products were not found",
          404,
          "PRODUCT_NOT_FOUND",
        );
      }

      const orderItems = input.items.map((item) => {
        const product = products.find(
          (candidate) => candidate.id === item.productId,
        );
        if (!product) {
          throw new AppError(
            "One or more products were not found",
            404,
            "PRODUCT_NOT_FOUND",
          );
        }

        if (!product.active) {
          throw new AppError(
            `${product.name} is not available for customer orders`,
            409,
            "PRODUCT_UNAVAILABLE",
          );
        }

        const quantity = new Prisma.Decimal(item.quantity);
        const currentStock = new Prisma.Decimal(product.currentStock);
        if (currentStock.lt(quantity)) {
          throw new AppError(
            `${product.name} is not currently available in the requested quantity`,
            409,
            "PRODUCT_UNAVAILABLE",
          );
        }

        const unitPrice = new Prisma.Decimal(product.sellingPrice);
        const lineSubtotal = quantity.mul(unitPrice).toDecimalPlaces(2);

        return {
          product,
          quantity,
          unitPrice,
          lineSubtotal,
        };
      });

      const subtotal = orderItems
        .reduce(
          (total, item) => total.plus(item.lineSubtotal),
          new Prisma.Decimal(0),
        )
        .toDecimalPlaces(2);
      const reference = await this.generateOrderReference(tx, now);

      return tx.order.create({
        data: {
          reference,
          customerId: input.customerId,
          status: OrderStatus.PENDING,
          paymentStatus: OrderPaymentStatus.UNPAID,
          subtotal,
          createdAt: now,
          items: {
            create: orderItems.map((item) => ({
              productId: item.product.id,
              productName: item.product.name,
              productSku: item.product.sku,
              productCategory: item.product.category,
              productUnit: item.product.unit,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              lineSubtotal: item.lineSubtotal,
              createdAt: now,
            })),
          },
        },
        include: orderInclude,
      });
    }, inventoryTransactionOptions);
  }

  async list(input: ListOrdersInput) {
    const where = this.buildReadableOrderWhere(input);

    return this.db.order.findMany({
      where: {
        ...where,
        status: input.status,
        paymentStatus: input.paymentStatus,
      },
      include: orderInclude,
      orderBy: { createdAt: "desc" },
      take: input.limit ?? 25,
    });
  }

  async getById(input: GetOrderInput) {
    const order = await this.db.order.findUnique({
      where: { id: input.orderId },
      include: orderInclude,
    });

    if (!order || !this.canReadOrder(input, order.customerId)) {
      throw new AppError("Order not found", 404, "ORDER_NOT_FOUND");
    }

    return order;
  }

  async cancel(input: CancelOrderInput) {
    if (input.requesterRole !== UserRole.CUSTOMER) {
      throw new AppError(
        "Only customers can cancel their own orders",
        403,
        "CUSTOMER_ORDER_REQUIRED",
      );
    }

    return this.db.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT "id" FROM "Order" WHERE "id" = ${input.orderId} FOR UPDATE
      `;

      const order = await tx.order.findUnique({
        where: { id: input.orderId },
        include: orderInclude,
      });

      if (!order || order.customerId !== input.requesterId) {
        throw new AppError("Order not found", 404, "ORDER_NOT_FOUND");
      }

      if (order.status === OrderStatus.CANCELLED) {
        throw new AppError(
          "Order has already been cancelled",
          409,
          "ORDER_ALREADY_CANCELLED",
        );
      }

      if (
        order.status !== OrderStatus.PENDING &&
        order.status !== OrderStatus.CONFIRMED
      ) {
        throw new AppError(
          "Order cannot be cancelled from its current state",
          409,
          "ORDER_NOT_CANCELLABLE",
        );
      }

      return tx.order.update({
        where: { id: order.id },
        data: {
          status: OrderStatus.CANCELLED,
          cancelledAt: new Date(),
          cancelReason: input.reason?.trim() || null,
        },
        include: orderInclude,
      });
    }, inventoryTransactionOptions);
  }

  private buildReadableOrderWhere(input: ListOrdersInput) {
    if (input.requesterRole === UserRole.CUSTOMER) {
      return { customerId: input.requesterId };
    }

    if (roleHasPermission(input.requesterRole, permissions.READ_ORDERS)) {
      return {};
    }

    throw new AppError(
      "You do not have permission to view customer orders",
      403,
      "FORBIDDEN",
    );
  }

  private canReadOrder(input: GetOrderInput, customerId: string) {
    return (
      (input.requesterRole === UserRole.CUSTOMER &&
        input.requesterId === customerId) ||
      roleHasPermission(input.requesterRole, permissions.READ_ORDERS)
    );
  }

  private async generateOrderReference(
    tx: Prisma.TransactionClient,
    createdAt: Date,
  ) {
    const [sequenceValue] = await tx.$queryRaw<Array<{ value: bigint }>>`
      SELECT nextval('"OrderReferenceSequence"')::bigint AS value
    `;

    if (!sequenceValue) {
      throw new AppError(
        "Unable to generate order reference",
        500,
        "ORDER_REFERENCE_FAILED",
      );
    }

    const datePart = createdAt.toISOString().slice(0, 10).replaceAll("-", "");
    return `MD-ORD-${datePart}-${sequenceValue.value
      .toString()
      .padStart(5, "0")}`;
  }
}
