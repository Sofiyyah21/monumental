import { SaleStatus } from "@prisma/client";
import { getEnv } from "../config/env.js";
import type { DatabaseClient } from "../lib/database.js";
import { getReportDateRange, type ReportPeriod } from "../lib/date-range.js";

export class ReportService {
  constructor(private readonly db: DatabaseClient) {}

  async getPeriodSummary(period: ReportPeriod, now = new Date()) {
    const range = getReportDateRange(period, now, getEnv().BUSINESS_TIMEZONE);
    const sales = await this.db.sale.findMany({
      where: {
        status: SaleStatus.COMPLETED,
        soldAt: {
          gte: range.start,
          lt: range.end,
        },
      },
      include: { items: true },
      orderBy: { soldAt: "desc" },
    });

    const productMap = new Map<
      string,
      {
        productId: string;
        productName: string;
        quantitySold: number;
        revenue: number;
        cost: number;
        grossProfit: number;
      }
    >();

    const totals = sales.reduce(
      (summary, sale) => {
        summary.revenue += Number(sale.totalAmount);
        summary.cost += Number(sale.totalCost);
        summary.grossProfit += Number(sale.grossProfit);

        for (const item of sale.items) {
          const existing = productMap.get(item.productId) ?? {
            productId: item.productId,
            productName: item.productName,
            quantitySold: 0,
            revenue: 0,
            cost: 0,
            grossProfit: 0,
          };
          existing.quantitySold += Number(item.quantity);
          existing.revenue += Number(item.lineTotal);
          existing.cost += Number(item.lineCost);
          existing.grossProfit += Number(item.grossProfit);
          productMap.set(item.productId, existing);
        }

        return summary;
      },
      { salesCount: sales.length, revenue: 0, cost: 0, grossProfit: 0 },
    );

    const products = [...productMap.values()]
      .map((product) => ({
        ...product,
        revenue: this.round(product.revenue),
        cost: this.round(product.cost),
        grossProfit: this.round(product.grossProfit),
      }))
      .sort((a, b) => b.quantitySold - a.quantitySold);

    return {
      period,
      range,
      totals: {
        ...totals,
        revenue: this.round(totals.revenue),
        cost: this.round(totals.cost),
        grossProfit: this.round(totals.grossProfit),
      },
      products,
    };
  }

  async getDashboard(now = new Date()) {
    const [today, week, month, year, inventory, recentTransactions] =
      await Promise.all([
        this.getPeriodSummary("today", now),
        this.getPeriodSummary("week", now),
        this.getPeriodSummary("month", now),
        this.getPeriodSummary("year", now),
        this.db.product.findMany({
          where: { active: true },
          orderBy: [{ category: "asc" }, { name: "asc" }],
        }),
        this.db.sale.findMany({
          where: { status: SaleStatus.COMPLETED },
          include: {
            seller: {
              select: { id: true, name: true, email: true, role: true },
            },
            customer: {
              select: { id: true, name: true, email: true, role: true },
            },
            items: true,
          },
          orderBy: { soldAt: "desc" },
          take: 10,
        }),
      ]);

    const lowStockProducts = inventory
      .filter(
        (product) =>
          Number(product.currentStock) <= Number(product.reorderLevel),
      )
      .sort((a, b) => Number(a.currentStock) - Number(b.currentStock))
      .slice(0, 10);
    const bestSellingProducts = year.products.slice(0, 5);

    return {
      summaries: { today, week, month, year },
      inventory,
      lowStockProducts,
      bestSellingProducts,
      recentTransactions,
    };
  }

  private round(value: number) {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }
}
