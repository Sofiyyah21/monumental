import { z } from "zod";

export const cuidParamSchema = z.object({
  id: z.string().min(1),
});

export const paginationQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export const positiveMoneySchema = z.coerce
  .number()
  .positive()
  .multipleOf(0.01);
export const nonNegativeMoneySchema = z.coerce.number().min(0).multipleOf(0.01);
export const positiveQuantitySchema = z.coerce.number().positive();
export const nonNegativeQuantitySchema = z.coerce.number().min(0);
