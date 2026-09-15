import { ProductCategory, ProductUnit, SaleStatus } from "@prisma/client";
import { z } from "zod";
import { paginationQuerySchema } from "./common.js";

const reportDateSchema = z
  .string()
  .trim()
  .refine((value) => isValidReportDate(value), {
    message: "Date must be a valid ISO date or date-time",
  });

export const reportPeriodSchema = z.enum(["today", "week", "month", "year"]);

const reportFilterSchema = z
  .object({
    from: reportDateSchema.optional(),
    to: reportDateSchema.optional(),
    productId: z.string().min(1).optional(),
    category: z
      .enum([
        ProductCategory.DRINKS,
        ProductCategory.NOODLES,
        ProductCategory.VEGETABLE_OIL,
        ProductCategory.SUGAR,
      ])
      .optional(),
    unit: z
      .enum([ProductUnit.PACK, ProductUnit.LITER, ProductUnit.CUP])
      .optional(),
    sellerId: z.string().min(1).optional(),
    status: z
      .enum([SaleStatus.COMPLETED, SaleStatus.VOIDED, SaleStatus.REFUNDED])
      .optional(),
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

export const reportQuerySchema = z.object({
  period: reportPeriodSchema.default("today"),
});

export const reportFilterQuerySchema = reportFilterSchema;

export const bestSellersQuerySchema = reportFilterSchema.extend({
  limit: paginationQuerySchema.shape.limit,
});

function isValidReportDate(value: string) {
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
