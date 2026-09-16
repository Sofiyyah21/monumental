import type { ProductCategory, ProductUnit } from "../api/types";

export const productCategoryLabels: Record<ProductCategory, string> = {
  DRINKS: "Drinks",
  NOODLES: "Noodles",
  VEGETABLE_OIL: "Vegetable oil",
  SUGAR: "Sugar",
};

export const productUnitLabels: Record<ProductUnit, string> = {
  PACK: "Pack",
  LITER: "Liter",
  CUP: "Cup",
};

export const productUnitByCategory: Record<ProductCategory, ProductUnit> = {
  DRINKS: "PACK",
  NOODLES: "PACK",
  VEGETABLE_OIL: "LITER",
  SUGAR: "CUP",
};

export const productCategories = Object.keys(
  productCategoryLabels,
) as ProductCategory[];

export const productUnits = Object.keys(productUnitLabels) as ProductUnit[];

export function getUnitForCategory(category: ProductCategory) {
  return productUnitByCategory[category];
}

export function isValidCategoryUnit(
  category: ProductCategory,
  unit: ProductUnit,
) {
  return productUnitByCategory[category] === unit;
}

export function formatMoney(value: string | number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 2,
  }).format(Number(value));
}

export function formatQuantity(value: string | number) {
  return new Intl.NumberFormat("en-NG", {
    maximumFractionDigits: 3,
  }).format(Number(value));
}

export function productErrorMessage(error: {
  code?: string;
  status?: number;
  message?: string;
}) {
  if (error.code === "PRODUCT_SKU_EXISTS" || error.status === 409) {
    return "A product with this SKU already exists. SKUs are saved in uppercase.";
  }
  if (error.code === "INVALID_PRODUCT_UNIT") {
    return "The selected category and unit do not match Monumental Details product rules.";
  }
  if (error.status === 401) {
    return "Your session has expired. Sign in again to continue.";
  }
  if (error.status === 403) {
    return "Your account does not have permission to manage products.";
  }
  if (error.status === 400) {
    return "Check the product details and try again.";
  }
  return "The product request could not be completed.";
}
