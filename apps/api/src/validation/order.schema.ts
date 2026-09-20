import { OrderPaymentStatus, OrderStatus } from "@prisma/client";
import { z } from "zod";
import { paginationQuerySchema } from "./common.js";

const orderItemSchema = z.object({
  productId: z.string().trim().min(1),
  quantity: z.coerce.number().int().positive(),
});

const orderDateSchema = z
  .string()
  .trim()
  .refine((value) => isValidOrderDate(value), {
    message: "Date must be a valid ISO date or date-time",
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

export const listOrdersQuerySchema = paginationQuerySchema
  .extend({
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
    customerId: z.string().trim().min(1).optional(),
    from: orderDateSchema.optional(),
    to: orderDateSchema.optional(),
  })
  .superRefine((data, context) => {
    if (!data.from || !data.to) {
      return;
    }

    const from = new Date(data.from);
    const to = new Date(data.to);
    if (
      !Number.isNaN(from.getTime()) &&
      !Number.isNaN(to.getTime()) &&
      from > to
    ) {
      context.addIssue({
        code: "custom",
        path: ["to"],
        message: "End date must be after start date",
      });
    }
  });

export const orderIdParamSchema = z.object({
  id: z.string().trim().min(1),
});

export const cancelOrderSchema = z
  .object({
    reason: z.string().trim().min(1).max(500).optional(),
  })
  .default({});

function isValidOrderDate(value: string) {
  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (dateOnlyMatch) {
    const [, year, month, day] = dateOnlyMatch.map(Number);
    const parsed = new Date(Date.UTC(year, month - 1, day));
    return (
      parsed.getUTCFullYear() === year &&
      parsed.getUTCMonth() === month - 1 &&
      parsed.getUTCDate() === day
    );
  }

  return !Number.isNaN(Date.parse(value));
}
