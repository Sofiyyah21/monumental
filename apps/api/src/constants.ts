import { ProductCategory, ProductUnit, UserRole } from "@prisma/client";

export const productUnitByCategory: Record<ProductCategory, ProductUnit> = {
  [ProductCategory.DRINKS]: ProductUnit.PACK,
  [ProductCategory.NOODLES]: ProductUnit.PACK,
  [ProductCategory.VEGETABLE_OIL]: ProductUnit.LITER,
  [ProductCategory.SUGAR]: ProductUnit.CUP,
};

export const internalRoles = [
  UserRole.ADMIN,
  UserRole.MANAGER,
  UserRole.STAFF,
] as const;
