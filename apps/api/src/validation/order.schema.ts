import { OrderPaymentStatus, OrderStatus } from "@prisma/client";
import { z } from "zod";
import { paginationQuerySchema } from "./common.js";

const orderItemSchema = z.object({
  productId: z.string().trim().min(1),
  quantity: z.coerce.number().int().positive(),
});

export const createOrderSchema = z
  .object({
    items: z.array(orderItemSchema).min(1),
  })
  .superRefine((data, context) => {
    const productIds = new Set<string>();
    for (const [index, item] of data.items.entries()) {
      if (productIds.has(item.productId)) {
        context.addIssue({
          code: "custom",
          path: ["items", index, "productId"],
          message: "Duplicate product IDs are not allowed",
        });
      }
      productIds.add(item.productId);
    }
  });

export const listOrdersQuerySchema = paginationQuerySchema.extend({
  status: z
    .enum([
      OrderStatus.PENDING,
      OrderStatus.CONFIRMED,
      OrderStatus.CANCELLED,
      OrderStatus.FULFILLED,
    ])
    .optional(),
  paymentStatus: z
    .enum([
      OrderPaymentStatus.UNPAID,
      OrderPaymentStatus.PAID,
      OrderPaymentStatus.FAILED,
    ])
    .optional(),
});

export const orderIdParamSchema = z.object({
  id: z.string().trim().min(1),
});

export const cancelOrderSchema = z.object({
  reason: z.string().trim().min(1).max(500).optional(),
});
