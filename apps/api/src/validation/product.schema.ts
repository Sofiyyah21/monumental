import { ProductCategory, ProductUnit } from "@prisma/client";
import { z } from "zod";
import { productUnitByCategory } from "../constants.js";
import { nonNegativeMoneySchema, nonNegativeQuantitySchema } from "./common.js";

const productCategorySchema = z.enum([
  ProductCategory.DRINKS,
  ProductCategory.NOODLES,
  ProductCategory.VEGETABLE_OIL,
  ProductCategory.SUGAR,
]);

const productUnitSchema = z.enum([
  ProductUnit.PACK,
  ProductUnit.LITER,
  ProductUnit.CUP,
]);

const skuSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[A-Z0-9][A-Z0-9_-]*$/i, {
    message: "SKU must contain only letters, numbers, underscores, and hyphens",
  })
  .transform((value) => value.toUpperCase());

function validateCategoryUnit(
  data: { category?: ProductCategory; unit?: ProductUnit },
  context: z.RefinementCtx,
) {
  if (!data.category || !data.unit) {
    return;
  }

  if (productUnitByCategory[data.category] !== data.unit) {
    context.addIssue({
      code: "custom",
      path: ["unit"],
      message: `${data.category} products must use ${productUnitByCategory[data.category]}`,
    });
  }
}

const productFieldsSchema = z.object({
  name: z.string().trim().min(1).max(120),
  sku: skuSchema,
  category: productCategorySchema,
  unit: productUnitSchema,
  costPrice: nonNegativeMoneySchema,
  sellingPrice: nonNegativeMoneySchema,
  reorderLevel: nonNegativeQuantitySchema.default(0),
});

export const createProductSchema =
  productFieldsSchema.superRefine(validateCategoryUnit);

export const updateProductSchema = productFieldsSchema
  .partial()
  .extend({
    active: z.boolean().optional(),
  })
  .superRefine(validateCategoryUnit);

export const listProductsQuerySchema = z.object({
  category: productCategorySchema.optional(),
  unit: productUnitSchema.optional(),
  active: z.coerce.boolean().optional(),
  search: z.string().trim().min(1).max(120).optional(),
});
