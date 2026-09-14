import { ProductCategory } from "@prisma/client";
import { z } from "zod";
import {
  nonNegativeMoneySchema,
  nonNegativeQuantitySchema,
  positiveMoneySchema,
} from "./common.js";

export const createProductSchema = z.object({
  name: z.string().trim().min(1).max(120),
  category: z.enum([
    ProductCategory.DRINK,
    ProductCategory.NOODLES,
    ProductCategory.VEGETABLE_OIL,
    ProductCategory.SUGAR,
  ]),
  costPrice: nonNegativeMoneySchema,
  sellingPrice: positiveMoneySchema,
  lowStockThreshold: nonNegativeQuantitySchema.default(0),
});

export const updateProductSchema = createProductSchema.partial().extend({
  active: z.boolean().optional(),
});

export const listProductsQuerySchema = z.object({
  includeInactive: z.coerce.boolean().default(false),
});
