import {
  Prisma,
  ProductCategory,
  ProductUnit,
  SaleStatus,
} from "@prisma/client";
import { getEnv } from "../config/env.js";
import type { DatabaseClient } from "../lib/database.js";
import {
  getCustomReportDateRange,
  getReportDateRange,
  type ReportDateRange,
  type ReportPeriod,
} from "../lib/date-range.js";
import { getStockStatus } from "./inventory-rules.js";

export type ReportFilters = {
  from?: string;
  to?: string;
  productId?: string;
  category?: ProductCategory;
  unit?: ProductUnit;
  sellerId?: string;
  status?: SaleStatus;
  limit?: number;
};

type ProductSalesRow = {
  productId: string;
  productName: string;
  unit: ProductUnit;
  quantitySold: Prisma.Decimal;
  revenue: Prisma.Decimal;
  cogs: Prisma.Decimal;
  grossProfit: Prisma.Decimal;
};

const zeroMoney = new Prisma.Decimal(0).toDecimalPlaces(2);
const zeroQuantity = new Prisma.Decimal(0).toDecimalPlaces(3);

export class ReportService {
  constructor(private readonly db: DatabaseClient) {}

  async getPeriodSummary(
    period: ReportPeriod,
    filters: Omit<ReportFilters, "from" | "to"> = {},
    now = new Date(),
  ) {
    const range = getReportDateRange(period, now, getEnv().BUSINESS_TIMEZONE);
    return this.getSalesSummaryForRange(period, range, filters);
  }

  async getCustomSalesSummary(filters: ReportFilters = {}, now = new Date()) {
    const range = getCustomReportDateRange(
      filters,
      now,
      getEnv().BUSINESS_TIMEZONE,
    );
    return this.getSalesSummaryForRange("custom", range, filters);
  }

  async getProductSales(filters: ReportFilters = {}, now = new Date()) {
    const range = this.resolveRange(filters, now);
    const rows = await this.getProductSalesRows(range, filters);

    return {
      period: this.getPeriodLabel(filters),
      range,
      products: rows,
    };
  }

  async getBestSellers(filters: ReportFilters = {}, now = new Date()) {
    const range = this.resolveRange(filters, now);
    const rows = await this.getProductSalesRows(range, filters);
    const limit = filters.limit ?? 10;

    return {
      period: this.getPeriodLabel(filters),
      range,
      rankingMetric: "quantitySold",
      products: rows
        .sort((a, b) => decimalCompareDesc(a.quantitySold, b.quantitySold))
        .slice(0, limit)
        .map((product, index) => ({ rank: index + 1, ...product })),
    };
  }

  async getLowStockReport() {
    const products = await this.db.product.findMany({
      where: { active: true },
      orderBy: [{ category: "asc" }, { name: "asc" }],
    });

    return products
      .map((product) => ({
        productId: product.id,
        name: product.name,
        sku: product.sku,
        category: product.category,
        unit: product.unit,
        currentStock: product.currentStock,
        reorderLevel: product.reorderLevel,
        stockStatus: getStockStatus(product),
      }))
      .filter((product) => product.stockStatus !== "IN_STOCK")
      .sort((a, b) => Number(a.currentStock) - Number(b.currentStock));
  }

  async getInventorySummary() {
    const products = await this.db.product.findMany({
      where: { active: true },
      orderBy: [{ category: "asc" }, { name: "asc" }],
    });

    const byUnit = new Map<
      ProductUnit,
      { unit: ProductUnit; productCount: number; currentStock: Prisma.Decimal }
    >();
    let lowStockProductCount = 0;
    let outOfStockProductCount = 0;

    for (const product of products) {
      const status = getStockStatus(product);
      if (status === "LOW_STOCK") {
        lowStockProductCount += 1;
      }
      if (status === "OUT_OF_STOCK") {
        outOfStockProductCount += 1;
      }

      const existing = byUnit.get(product.unit) ?? {
        unit: product.unit,
        productCount: 0,
        currentStock: zeroQuantity,
      };
      existing.productCount += 1;
      existing.currentStock = existing.currentStock
        .plus(product.currentStock)
        .toDecimalPlaces(3);
      byUnit.set(product.unit, existing);
    }

    return {
      totalActiveProducts: products.length,
      lowStockProductCount,
      outOfStockProductCount,
      stockByUnit: [...byUnit.values()].sort((a, b) =>
        a.unit.localeCompare(b.unit),
      ),
    };
  }

  async getDashboard(now = new Date()) {
    const [
      today,
      week,
      month,
      year,
      inventorySummary,
      lowStockProducts,
      recentTransactions,
    ] = await Promise.all([
      this.getPeriodSummary("today", {}, now),
      this.getPeriodSummary("week", {}, now),
      this.getPeriodSummary("month", {}, now),
      this.getPeriodSummary("year", {}, now),
      this.getInventorySummary(),
      this.getLowStockReport(),
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

    const bestSellingProducts = await this.getBestSellers(
      {
        from: year.range.start.toISOString(),
        to: year.range.end.toISOString(),
        limit: 5,
      },
      now,
    );

    return {
      summaries: { today, week, month, year },
      inventorySummary,
      lowStockProducts: lowStockProducts.slice(0, 10),
      bestSellingProducts: bestSellingProducts.products,
      recentTransactions,
    };
  }

  private async getSalesSummaryForRange(
    period: ReportPeriod | "custom",
    range: ReportDateRange,
    filters: ReportFilters,
  ) {
    if (filters.status && filters.status !== SaleStatus.COMPLETED) {
      return this.emptySalesSummary(period, range);
    }

    const saleWhere = this.buildCompletedSaleWhere(range, filters);
    const [saleAggregate, itemAggregate] = await Promise.all([
      this.db.sale.aggregate({
        where: saleWhere,
        _count: { id: true },
        _sum: {
          totalAmount: true,
          totalCost: true,
          grossProfit: true,
          discountAmount: true,
        },
      }),
      this.db.saleItem.aggregate({
        where: { sale: saleWhere },
        _sum: { quantity: true },
      }),
    ]);

    const salesCount = saleAggregate._count.id;
    const revenue = this.money(saleAggregate._sum.totalAmount);
    const cogs = this.money(saleAggregate._sum.totalCost);
    const grossProfit = this.money(saleAggregate._sum.grossProfit);
    const discounts = this.money(saleAggregate._sum.discountAmount);
    const averageSaleValue =
      salesCount === 0 ? zeroMoney : revenue.div(salesCount).toDecimalPlaces(2);

    return {
      period,
      range,
      salesCount,
      unitsSold: this.quantity(itemAggregate._sum.quantity),
      revenue,
      cogs,
      grossProfit,
      discounts,
      averageSaleValue,
      totals: {
        salesCount,
        unitsSold: this.quantity(itemAggregate._sum.quantity),
        revenue,
        cost: cogs,
        cogs,
        grossProfit,
        discounts,
        averageSaleValue,
      },
    };
  }

  private async getProductSalesRows(
    range: ReportDateRange,
    filters: ReportFilters,
  ): Promise<ProductSalesRow[]> {
    if (filters.status && filters.status !== SaleStatus.COMPLETED) {
      return [];
    }

    const saleWhere = this.buildCompletedSaleWhere(range, filters);
    const rows = await this.db.saleItem.groupBy({
      by: ["productId", "productName", "productUnit"],
      where: {
        sale: saleWhere,
        productId: filters.productId,
        productUnit: filters.unit,
        product: filters.category ? { category: filters.category } : undefined,
      },
      _sum: {
        quantity: true,
        lineTotal: true,
        lineCost: true,
        grossProfit: true,
      },
    });

    return rows
      .map((row) => ({
        productId: row.productId,
        productName: row.productName,
        unit: row.productUnit,
        quantitySold: this.quantity(row._sum.quantity),
        revenue: this.money(row._sum.lineTotal),
        cogs: this.money(row._sum.lineCost),
        grossProfit: this.money(row._sum.grossProfit),
      }))
      .sort((a, b) => decimalCompareDesc(a.quantitySold, b.quantitySold));
  }

  private resolveRange(filters: ReportFilters, now: Date) {
    return getCustomReportDateRange(filters, now, getEnv().BUSINESS_TIMEZONE);
  }

  private getPeriodLabel(filters: ReportFilters) {
    return filters.from || filters.to ? "custom" : "today";
  }

  private buildCompletedSaleWhere(
    range: ReportDateRange,
    filters: ReportFilters,
  ): Prisma.SaleWhereInput {
    return {
      status: SaleStatus.COMPLETED,
      sellerId: filters.sellerId,
      soldAt: {
        gte: range.start,
        lt: range.end,
      },
    };
  }

  private emptySalesSummary(
    period: ReportPeriod | "custom",
    range: ReportDateRange,
  ) {
    return {
      period,
      range,
      salesCount: 0,
      unitsSold: zeroQuantity,
      revenue: zeroMoney,
      cogs: zeroMoney,
      grossProfit: zeroMoney,
      discounts: zeroMoney,
      averageSaleValue: zeroMoney,
      totals: {
        salesCount: 0,
        unitsSold: zeroQuantity,
        revenue: zeroMoney,
        cost: zeroMoney,
        cogs: zeroMoney,
        grossProfit: zeroMoney,
        discounts: zeroMoney,
        averageSaleValue: zeroMoney,
      },
    };
  }

  private money(value: Prisma.Decimal | number | string | null | undefined) {
    return new Prisma.Decimal(value?.toString() ?? 0).toDecimalPlaces(2);
  }

  private quantity(value: Prisma.Decimal | number | string | null | undefined) {
    return new Prisma.Decimal(value?.toString() ?? 0).toDecimalPlaces(3);
  }
}

function decimalCompareDesc(left: Prisma.Decimal, right: Prisma.Decimal) {
  if (right.gt(left)) {
    return 1;
  }
  if (right.lt(left)) {
    return -1;
  }
  return 0;
}
