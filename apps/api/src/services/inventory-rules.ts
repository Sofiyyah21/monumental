export function isLowStock(product: {
  currentStock: { toString(): string } | number | string;
  reorderLevel: { toString(): string } | number | string;
}) {
  return Number(product.currentStock) <= Number(product.reorderLevel);
}

export type StockStatus = "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK";

export function getStockStatus(product: {
  currentStock: { toString(): string } | number | string;
  reorderLevel: { toString(): string } | number | string;
}): StockStatus {
  const currentStock = Number(product.currentStock);

  if (currentStock <= 0) {
    return "OUT_OF_STOCK";
  }

  return isLowStock(product) ? "LOW_STOCK" : "IN_STOCK";
}
