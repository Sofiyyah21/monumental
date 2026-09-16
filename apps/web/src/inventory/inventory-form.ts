import type {
  InventoryItem,
  ProductUnit,
  StockAdjustmentInput,
  StockDamageInput,
  StockReceiptInput,
  StockReturnInput,
} from "../api/types";

export type InventoryOperation = "receive" | "adjust" | "return" | "damage";

export type InventoryOperationForm = {
  operation: InventoryOperation;
  productId: string;
  unit: ProductUnit | "";
  quantity: string;
  quantityChange: string;
  unitCost: string;
  reference: string;
  note: string;
  reason: string;
};

export type InventoryOperationInput =
  | { ok: true; operation: "receive"; value: StockReceiptInput }
  | { ok: true; operation: "adjust"; value: StockAdjustmentInput }
  | { ok: true; operation: "return"; value: StockReturnInput }
  | { ok: true; operation: "damage"; value: StockDamageInput }
  | { ok: false; message: string };

export const emptyInventoryForm: InventoryOperationForm = {
  operation: "receive",
  productId: "",
  unit: "",
  quantity: "",
  quantityChange: "",
  unitCost: "",
  reference: "",
  note: "",
  reason: "",
};

export function syncFormToProduct(
  form: InventoryOperationForm,
  product: InventoryItem | undefined,
): InventoryOperationForm {
  return {
    ...form,
    productId: product?.productId ?? "",
    unit: product?.unit ?? "",
  };
}

export function toInventoryOperationInput(
  form: InventoryOperationForm,
): InventoryOperationInput {
  if (!form.productId) {
    return { ok: false, message: "Choose a product." };
  }
  if (!form.unit) {
    return { ok: false, message: "The selected product is missing a unit." };
  }

  if (form.operation === "adjust") {
    const quantityChange = Number(form.quantityChange);
    if (Number.isNaN(quantityChange) || quantityChange === 0) {
      return { ok: false, message: "Adjustment quantity cannot be zero." };
    }
    if (!form.reason.trim()) {
      return { ok: false, message: "Adjustment reason is required." };
    }
    return {
      ok: true,
      operation: "adjust",
      value: {
        productId: form.productId,
        quantityChange,
        unit: form.unit,
        reason: form.reason.trim(),
        reference: optionalText(form.reference),
      },
    };
  }

  const quantity = Number(form.quantity);
  if (Number.isNaN(quantity) || quantity <= 0) {
    return { ok: false, message: "Quantity must be greater than zero." };
  }

  if (form.operation === "receive") {
    const unitCost =
      form.unitCost.trim() === "" ? undefined : Number(form.unitCost);
    if (unitCost !== undefined && (Number.isNaN(unitCost) || unitCost < 0)) {
      return { ok: false, message: "Unit cost must be zero or greater." };
    }
    return {
      ok: true,
      operation: "receive",
      value: {
        productId: form.productId,
        quantity,
        unit: form.unit,
        unitCost,
        reference: optionalText(form.reference),
        note: optionalText(form.note),
      },
    };
  }

  if (form.operation === "return") {
    return {
      ok: true,
      operation: "return",
      value: {
        productId: form.productId,
        quantity,
        unit: form.unit,
        reference: optionalText(form.reference),
        note: optionalText(form.note),
      },
    };
  }

  if (!form.reason.trim()) {
    return { ok: false, message: "Damage reason is required." };
  }
  return {
    ok: true,
    operation: "damage",
    value: {
      productId: form.productId,
      quantity,
      unit: form.unit,
      reason: form.reason.trim(),
      reference: optionalText(form.reference),
    },
  };
}

function optionalText(value: string) {
  const trimmed = value.trim();
  return trimmed || undefined;
}
