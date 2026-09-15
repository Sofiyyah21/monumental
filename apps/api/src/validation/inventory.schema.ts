import { ProductUnit, StockMovementType } from "@prisma/client";
import { z } from "zod";
import {
  nonNegativeMoneySchema,
  paginationQuerySchema,
  positiveQuantitySchema,
} from "./common.js";

const productUnitSchema = z.enum([
  ProductUnit.PACK,
  ProductUnit.LITER,
  ProductUnit.CUP,
]);

const stockMovementTypeSchema = z.enum([
  StockMovementType.RECEIVED,
  StockMovementType.SOLD,
  StockMovementType.ADJUSTMENT,
  StockMovementType.RETURN,
  StockMovementType.DAMAGE,
]);

const referenceSchema = z.string().trim().min(1).max(120).optional();
const noteSchema = z.string().trim().max(500).optional();
const requiredReasonSchema = z.string().trim().min(1).max(500);

export const receiveStockSchema = z.object({
  productId: z.string().min(1),
  quantity: positiveQuantitySchema,
  unit: productUnitSchema,
  unitCost: nonNegativeMoneySchema.optional(),
  reference: referenceSchema,
  note: noteSchema,
});

export const adjustStockSchema = z.object({
  productId: z.string().min(1),
  quantityChange: z.coerce.number().refine((value) => value !== 0, {
    message: "Quantity change cannot be zero",
  }),
  unit: productUnitSchema,
  reason: requiredReasonSchema,
  reference: referenceSchema,
});

export const returnStockSchema = z.object({
  productId: z.string().min(1),
  quantity: positiveQuantitySchema,
  unit: productUnitSchema,
  reference: referenceSchema,
  note: noteSchema,
});

export const recordDamageSchema = z.object({
  productId: z.string().min(1),
  quantity: positiveQuantitySchema,
  unit: productUnitSchema,
  reason: requiredReasonSchema,
  reference: referenceSchema,
});

export const stockMovementQuerySchema = paginationQuerySchema
  .extend({
    productId: z.string().min(1).optional(),
    type: stockMovementTypeSchema.optional(),
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

export const inventoryListQuerySchema = z.object({
  active: z.coerce.boolean().optional(),
  lowStock: z.coerce.boolean().optional(),
});

export const currentStockParamsSchema = z.object({
  productId: z.string().min(1),
});
