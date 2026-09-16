import type {
  Product,
  ProductCategory,
  ProductInput,
  ProductUnit,
} from "../api/types";
import {
  getUnitForCategory,
  isValidCategoryUnit,
  productCategoryLabels,
  productUnitLabels,
} from "./product-utils";

export type ProductFormState = {
  id?: string;
  name: string;
  sku: string;
  category: ProductCategory;
  unit: ProductUnit;
  costPrice: string;
  sellingPrice: string;
  reorderLevel: string;
};

export const emptyProductForm: ProductFormState = {
  name: "",
  sku: "",
  category: "DRINKS",
  unit: "PACK",
  costPrice: "",
  sellingPrice: "",
  reorderLevel: "0",
};

export function toFormState(product: Product): ProductFormState {
  return {
    id: product.id,
    name: product.name,
    sku: product.sku,
    category: product.category,
    unit: product.unit,
    costPrice: product.costPrice,
    sellingPrice: product.sellingPrice,
    reorderLevel: product.reorderLevel,
  };
}

export function toProductInput(
  form: ProductFormState,
): { ok: true; value: ProductInput } | { ok: false; message: string } {
  const costPrice = Number(form.costPrice);
  const sellingPrice = Number(form.sellingPrice);
  const reorderLevel = Number(form.reorderLevel);

  if (!form.name.trim()) {
    return { ok: false, message: "Product name is required." };
  }
  if (!form.sku.trim()) {
    return { ok: false, message: "SKU is required." };
  }
  if (!isValidCategoryUnit(form.category, form.unit)) {
    return {
      ok: false,
      message: `${productCategoryLabels[form.category]} products must use ${
        productUnitLabels[getUnitForCategory(form.category)]
      }.`,
    };
  }
  if (Number.isNaN(costPrice) || costPrice < 0) {
    return { ok: false, message: "Cost price must be zero or greater." };
  }
  if (Number.isNaN(sellingPrice) || sellingPrice < 0) {
    return { ok: false, message: "Selling price must be zero or greater." };
  }
  if (Number.isNaN(reorderLevel) || reorderLevel < 0) {
    return { ok: false, message: "Reorder level must be zero or greater." };
  }

  return {
    ok: true,
    value: {
      name: form.name.trim(),
      sku: form.sku.trim().toUpperCase(),
      category: form.category,
      unit: form.unit,
      costPrice,
      sellingPrice,
      reorderLevel,
    },
  };
}
