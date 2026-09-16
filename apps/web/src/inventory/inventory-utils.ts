import type {
  InventoryItem,
  ProductUnit,
  StockMovementType,
  StockStatus,
} from "../api/types";
import { formatMoney, formatQuantity } from "../products/product-utils";

export const stockMovementTypeLabels: Record<StockMovementType, string> = {
  RECEIVED: "Received",
  SOLD: "Sold",
  ADJUSTMENT: "Adjustment",
  RETURN: "Return",
  DAMAGE: "Damage",
};

export const stockMovementTypes: StockMovementType[] = [
  "RECEIVED",
  "SOLD",
  "ADJUSTMENT",
  "RETURN",
  "DAMAGE",
];

export const stockStatusLabels: Record<StockStatus, string> = {
  IN_STOCK: "In stock",
  LOW_STOCK: "Low stock",
  OUT_OF_STOCK: "Out of stock",
};

export function getInventoryStockStatus(product: {
  currentStock: string | number;
  reorderLevel: string | number;
}): StockStatus {
  const currentStock = Number(product.currentStock);
  const reorderLevel = Number(product.reorderLevel);

  if (currentStock <= 0) {
    return "OUT_OF_STOCK";
  }
  return currentStock <= reorderLevel ? "LOW_STOCK" : "IN_STOCK";
}

export function formatInventoryQuantity(
  value: string | number,
  unit?: ProductUnit,
) {
  const formatted = formatQuantity(value);
  return unit ? `${formatted} ${unit.toLowerCase()}` : formatted;
}

export function formatInventoryMoney(
  value: string | number | null | undefined,
) {
  return value === null || value === undefined
    ? "Not recorded"
    : formatMoney(value);
}

export function summarizeInventory(items: InventoryItem[]) {
  const stockByUnit = new Map<ProductUnit, number>();
  let lowStockCount = 0;
  let outOfStockCount = 0;

  for (const item of items) {
    const status = getInventoryStockStatus(item);
    stockByUnit.set(
      item.unit,
      (stockByUnit.get(item.unit) ?? 0) + Number(item.currentStock),
    );
    if (status === "LOW_STOCK") {
      lowStockCount += 1;
    }
    if (status === "OUT_OF_STOCK") {
      outOfStockCount += 1;
    }
  }

  return {
    activeProductCount: items.filter((item) => item.active).length,
    lowStockCount,
    outOfStockCount,
    stockByUnit: [...stockByUnit.entries()].map(([unit, quantity]) => ({
      unit,
      quantity,
    })),
  };
}

export function inventoryErrorMessage(error: {
  code?: string;
  status?: number;
  message?: string;
}) {
  if (error.code === "NEGATIVE_STOCK_NOT_ALLOWED" || error.status === 409) {
    return "This operation would make stock negative. Refresh inventory and try a smaller quantity.";
  }
  if (error.code === "INVALID_STOCK_UNIT") {
    return "The selected unit does not match how this product is tracked.";
  }
  if (error.code === "INVALID_STOCK_QUANTITY") {
    return "Stock quantity must be greater than zero.";
  }
  if (error.code === "PRODUCT_NOT_FOUND" || error.status === 404) {
    return "The selected product could not be found or is inactive.";
  }
  if (error.status === 401) {
    return "Your session has expired. Sign in again to continue.";
  }
  if (error.status === 403) {
    return "Your account does not have permission to manage inventory.";
  }
  if (error.status === 400) {
    return "Check the inventory details and try again.";
  }
  return "The inventory request could not be completed.";
}
