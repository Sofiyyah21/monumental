import { PaymentMethod, PaymentStatus, SaleStatus } from "@prisma/client";
import { z } from "zod";
import {
  nonNegativeMoneySchema,
  paginationQuerySchema,
  positiveQuantitySchema,
} from "./common.js";

export const createSaleSchema = z.object({
  customerId: z.string().min(1).optional(),
  paymentMethod: z.enum([
    PaymentMethod.CASH,
    PaymentMethod.TRANSFER,
    PaymentMethod.CARD,
    PaymentMethod.OTHER,
  ]),
  paymentStatus: z
    .enum([PaymentStatus.PAID, PaymentStatus.PENDING])
    .default(PaymentStatus.PAID),
  paymentReference: z.string().trim().max(120).optional(),
  discountAmount: nonNegativeMoneySchema.default(0),
  soldAt: z.coerce.date().optional(),
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        quantity: positiveQuantitySchema,
      }),
    )
    .min(1),
});

export const listSalesQuerySchema = paginationQuerySchema
  .extend({
    sellerId: z.string().min(1).optional(),
    customerId: z.string().min(1).optional(),
    status: z
      .enum([SaleStatus.COMPLETED, SaleStatus.VOIDED, SaleStatus.REFUNDED])
      .optional(),
    paymentStatus: z
      .enum([PaymentStatus.PAID, PaymentStatus.PENDING])
      .optional(),
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
  })
  .superRefine((data, context) => {
    if (data.from && data.to && data.from > data.to) {
      context.addIssue({
        code: "custom",
        path: ["to"],
        message: "End date must be after start date",
      });
    }
  });

export const saleIdParamSchema = z.object({
  id: z.string().min(1),
});
