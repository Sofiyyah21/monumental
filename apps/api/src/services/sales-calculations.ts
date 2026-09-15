import { Prisma } from "@prisma/client";

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

export type DecimalSaleCalculationItem = {
  quantity: Prisma.Decimal;
  unitPrice: Prisma.Decimal;
  unitCost: Prisma.Decimal;
};

export function calculateSaleFinancials(
  items: DecimalSaleCalculationItem[],
  discountAmount = new Prisma.Decimal(0),
) {
  const totals = items.reduce(
    (summary, item) => {
      const lineTotal = item.quantity.mul(item.unitPrice).toDecimalPlaces(2);
      const lineCost = item.quantity.mul(item.unitCost).toDecimalPlaces(2);
      return {
        subtotal: summary.subtotal.plus(lineTotal),
        totalCost: summary.totalCost.plus(lineCost),
      };
    },
    {
      subtotal: new Prisma.Decimal(0),
      totalCost: new Prisma.Decimal(0),
    },
  );
  const normalizedDiscount = discountAmount.toDecimalPlaces(2);
  const totalAmount = totals.subtotal.minus(normalizedDiscount);

  return {
    subtotal: totals.subtotal.toDecimalPlaces(2),
    discountAmount: normalizedDiscount,
    totalAmount: totalAmount.toDecimalPlaces(2),
    totalCost: totals.totalCost.toDecimalPlaces(2),
    grossProfit: totalAmount.minus(totals.totalCost).toDecimalPlaces(2),
  };
}
