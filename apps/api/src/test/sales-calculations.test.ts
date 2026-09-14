import { describe, expect, it } from "vitest";
import { calculateSaleTotals } from "../services/sales-calculations.js";

describe("calculateSaleTotals", () => {
  it("separates revenue, cost of goods sold, and gross profit", () => {
    const totals = calculateSaleTotals([
      { quantity: 3, unitPrice: 1500, unitCost: 1000 },
      { quantity: 2.5, unitPrice: 800, unitCost: 600 },
    ]);

    expect(totals).toEqual({
      totalAmount: 6500,
      totalCost: 4500,
      grossProfit: 2000,
    });
  });
});
