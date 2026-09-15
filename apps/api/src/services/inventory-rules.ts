export function isLowStock(product: {
  currentStock: { toString(): string } | number | string;
  reorderLevel: { toString(): string } | number | string;
}) {
  return Number(product.currentStock) <= Number(product.reorderLevel);
}
