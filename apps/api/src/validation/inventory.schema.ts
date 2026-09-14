import { z } from "zod";
import { nonNegativeMoneySchema, positiveQuantitySchema } from "./common.js";

export const receiveStockSchema = z.object({
  productId: z.string().min(1),
  quantity: positiveQuantitySchema,
  unitCost: nonNegativeMoneySchema.optional(),
  note: z.string().trim().max(500).optional(),
});

export const adjustStockSchema = z.object({
  productId: z.string().min(1),
  newStock: z.coerce.number().min(0),
  note: z.string().trim().min(1).max(500),
});

export const returnStockSchema = z.object({
  productId: z.string().min(1),
  quantity: positiveQuantitySchema,
  note: z.string().trim().max(500).optional(),
});
