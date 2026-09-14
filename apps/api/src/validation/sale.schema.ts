import { PaymentMethod } from "@prisma/client";
import { z } from "zod";
import { positiveMoneySchema, positiveQuantitySchema } from "./common.js";

export const createSaleSchema = z.object({
  customerId: z.string().min(1).optional(),
  paymentMethod: z.enum([
    PaymentMethod.CASH,
    PaymentMethod.TRANSFER,
    PaymentMethod.CARD,
    PaymentMethod.OTHER,
  ]),
  paymentReference: z.string().trim().max(120).optional(),
  soldAt: z.coerce.date().optional(),
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        quantity: positiveQuantitySchema,
        unitPrice: positiveMoneySchema.optional(),
      }),
    )
    .min(1),
});

export const listSalesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25),
});
