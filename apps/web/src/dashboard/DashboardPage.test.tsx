import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { DashboardState } from "./useDashboardData";
import { DashboardView } from "./DashboardPage";

const summary = {
  period: "today",
  range: {
    start: "2026-09-14T23:00:00.000Z",
    end: "2026-09-15T23:00:00.000Z",
  },
  salesCount: 3,
  unitsSold: "8.000",
  revenue: "1200.00",
  cogs: "700.00",
  grossProfit: "500.00",
  discounts: "50.00",
  averageSaleValue: "400.00",
} as const;

function dashboardState(
  overrides: Partial<DashboardState> = {},
): DashboardState {
  return {
    data: {
      summary,
      bestSellers: {
        period: "today",
        range: summary.range,
        rankingMetric: "quantitySold",
        products: [
          {
            rank: 1,
            productId: "product_1",
            productName: "Indomie Noodles",
            unit: "PACK",
            quantitySold: "6.000",
            revenue: "900.00",
            cogs: "480.00",
            grossProfit: "420.00",
          },
        ],
      },
      lowStock: [],
      recentSales: [
        {
          id: "sale_1",
          reference: "MD-20260915-00001",
          sellerId: "user_1",
          customerId: null,
          status: "COMPLETED",
          paymentMethod: "CASH",
          paymentStatus: "PAID",
          totalAmount: "1200.00",
          grossProfit: "500.00",
          soldAt: "2026-09-15T10:00:00.000Z",
        },
      ],
    },
    lowStock: [
      {
        productId: "product_2",
        name: "Vegetable Oil",
        sku: "OIL-1",
        unit: "LITER",
        currentStock: "0.000",
        reorderLevel: "3.000",
        stockStatus: "OUT_OF_STOCK",
      },
      {
        productId: "product_3",
        name: "Sugar",
        sku: "SUGAR-1",
        unit: "CUP",
        currentStock: "2.000",
        reorderLevel: "5.000",
        stockStatus: "LOW_STOCK",
      },
    ],
    loading: false,
    lowStockLoading: false,
    error: null,
    lowStockError: null,
    ...overrides,
  };
}

function renderDashboard(
  state: DashboardState,
  options: {
    manager?: boolean;
    period?: "today" | "week" | "month" | "year" | "custom";
  } = {},
) {
  return renderToStaticMarkup(
    <DashboardView
      customRange={{ from: "2026-09-01", to: "2026-09-15" }}
      isManagerView={options.manager ?? false}
      onApplyCustomRange={vi.fn()}
      onCustomRangeChange={vi.fn()}
      onPeriodChange={vi.fn()}
      period={options.period ?? "today"}
      state={state}
    />,
  );
}

describe("DashboardView", () => {
  it("renders the admin dashboard KPIs, best sellers, low stock, and recent sales", () => {
    const html = renderDashboard(dashboardState());

    expect(html).toContain("Owner view");
    expect(html).toContain("Sales");
    expect(html).toContain("Units sold");
    expect(html).toContain("Revenue");
    expect(html).toContain("COGS");
    expect(html).toContain("Gross profit");
    expect(html).toContain("Discounts");
    expect(html).toContain("Average sale");
    expect(html).toContain("Indomie Noodles");
    expect(html).toContain("Vegetable Oil");
    expect(html).toContain("Out of stock");
    expect(html).toContain("Sugar");
    expect(html).toContain("Low stock");
    expect(html).toContain("MD-20260915-00001");
  });

  it("renders manager-specific dashboard framing", () => {
    const html = renderDashboard(dashboardState(), { manager: true });

    expect(html).toContain("Manager view");
    expect(html).toContain("Shop performance");
  });

  it("renders all supported period controls including custom range", () => {
    const html = renderDashboard(dashboardState(), { period: "custom" });

    expect(html).toContain("Today");
    expect(html).toContain("This Week");
    expect(html).toContain("This Month");
    expect(html).toContain("This Year");
    expect(html).toContain("Custom");
    expect(html).toContain("From");
    expect(html).toContain("To");
  });

  it("renders loading and API error states", () => {
    const loadingHtml = renderDashboard(
      dashboardState({ data: null, loading: true }),
    );
    const errorHtml = renderDashboard(
      dashboardState({
        data: null,
        loading: false,
        error: "Reporting data could not load.",
      }),
    );

    expect(loadingHtml).toContain("Loading reporting dashboard");
    expect(errorHtml).toContain("Reports unavailable");
    expect(errorHtml).toContain("Reporting data could not load.");
  });

  it("renders empty sales and secondary widget empty states", () => {
    const html = renderDashboard(
      dashboardState({
        data: {
          summary: { ...summary, salesCount: 0, unitsSold: "0.000" },
          bestSellers: {
            period: "today",
            range: summary.range,
            rankingMetric: "quantitySold",
            products: [],
          },
          lowStock: [],
          recentSales: [],
        },
        lowStock: [],
      }),
    );

    expect(html).toContain("No product sales yet");
    expect(html).toContain("Stock levels look steady");
    expect(html).toContain("No sales in this period");
  });
});
