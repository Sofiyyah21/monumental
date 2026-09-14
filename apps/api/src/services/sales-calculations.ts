export type SaleCalculationItem = {
  quantity: number;
  unitPrice: number;
  unitCost: number;
};

export function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function calculateSaleTotals(items: SaleCalculationItem[]) {
  return items.reduce(
    (totals, item) => {
      const lineTotal = roundMoney(item.quantity * item.unitPrice);
      const lineCost = roundMoney(item.quantity * item.unitCost);
      const grossProfit = roundMoney(lineTotal - lineCost);
      return {
        totalAmount: roundMoney(totals.totalAmount + lineTotal),
        totalCost: roundMoney(totals.totalCost + lineCost),
        grossProfit: roundMoney(totals.grossProfit + grossProfit),
      };
    },
    {
      totalAmount: 0,
      totalCost: 0,
      grossProfit: 0,
    },
  );
}
