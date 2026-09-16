import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { Sale } from "../api/types";
import {
  ReceiptView,
  SaleDetailView,
  SalesHistoryView,
} from "./SalesHistoryPage";
import {
  defaultSalesHistoryFilters,
  saleDisplayError,
  toSaleFilters,
} from "./sales-history-utils";

const sale: Sale = {
  id: "sale_1",
  reference: "MD-20260915-00001",
  sellerId: "user_1",
  customerId: null,
  status: "COMPLETED",
  paymentMethod: "CASH",
  paymentStatus: "PAID",
  paymentReference: null,
  subtotal: "6000.00",
  discountAmount: "500.00",
  totalAmount: "5500.00",
  totalCost: "5000.00",
  grossProfit: "500.00",
  soldAt: "2026-09-15T10:00:00.000Z",
  createdAt: "2026-09-15T10:00:00.000Z",
  updatedAt: "2026-09-15T10:00:00.000Z",
  seller: {
    id: "user_1",
    name: "Staff User",
    email: "staff@monumental.test",
    role: "STAFF",
  },
  items: [
    {
      id: "item_1",
      saleId: "sale_1",
      productId: "product_1",
      productName: "Historical Sugar",
      productUnit: "CUP",
      quantity: "2.000",
      unitPrice: "1000.00",
      unitCost: "700.00",
      lineTotal: "2000.00",
      lineCost: "1400.00",
      grossProfit: "600.00",
    },
    {
      id: "item_2",
      saleId: "sale_1",
      productId: "product_2",
      productName: "Indomie Noodles",
      productUnit: "PACK",
      quantity: "1.000",
      unitPrice: "4000.00",
      unitCost: "3600.00",
      lineTotal: "4000.00",
      lineCost: "3600.00",
      grossProfit: "400.00",
    },
  ],
};

function renderHistory(
  overrides: Partial<{
    error: string | null;
    loading: boolean;
    sales: Sale[];
  }> = {},
) {
  return renderToStaticMarkup(
    <SalesHistoryView
      error={overrides.error ?? null}
      filters={defaultSalesHistoryFilters}
      loading={overrides.loading ?? false}
      onFilterChange={vi.fn()}
      onOpenSale={vi.fn()}
      sales={overrides.sales ?? [sale]}
    />,
  );
}

describe("SalesHistoryView", () => {
  it("renders sales history with reference, date, total, payment status, item count, and cashier", () => {
    const html = renderHistory();

    expect(html).toContain("Transactions and receipts");
    expect(html).toContain("MD-20260915-00001");
    expect(html).toContain("15 Sept 2026");
    expect(html).toContain("₦5,500.00");
    expect(html).toContain("Paid");
    expect(html).toContain("2");
    expect(html).toContain("Staff User");
    expect(html).toContain("View MD-20260915-00001");
  });

  it("renders loading, empty, and API error states", () => {
    expect(renderHistory({ loading: true })).toContain("Loading sales history");
    expect(renderHistory({ sales: [] })).toContain("No sales found");
    expect(
      renderHistory({ error: "Sales information could not be loaded." }),
    ).toContain("Sales unavailable");
  });

  it("supports backend sales filters without frontend-only reference search", () => {
    expect(
      toSaleFilters({
        from: "2026-09-01",
        to: "2026-09-15",
        paymentStatus: "PENDING",
        limit: 50,
      }),
    ).toEqual({
      from: new Date("2026-09-01T00:00:00").toISOString(),
      to: new Date("2026-09-15T23:59:59.999").toISOString(),
      paymentStatus: "PENDING",
      limit: 50,
    });

    const html = renderHistory();
    expect(html).toContain("Payment status");
    expect(html).toContain("25 sales");
    expect(html).not.toContain("Reference search");
  });
});

describe("Sale detail and receipt", () => {
  it("renders sale detail actions, receipt branding, totals, payment, and historical line snapshots", () => {
    const html = renderToStaticMarkup(
      <SaleDetailView
        canViewFinancials
        error={null}
        loading={false}
        onBackToHistory={vi.fn()}
        onNewSale={vi.fn()}
        onPrint={vi.fn()}
        sale={sale}
      />,
    );

    expect(html).toContain("Print receipt");
    expect(html).toContain("Monumental");
    expect(html).toContain("Details");
    expect(html).toContain("Historical Sugar");
    expect(html).toContain("Cup");
    expect(html).toContain("2");
    expect(html).toContain("₦1,000.00");
    expect(html).toContain("₦2,000.00");
    expect(html).toContain("Subtotal");
    expect(html).toContain("Discount");
    expect(html).toContain("Total");
    expect(html).toContain("Gross profit");
  });

  it("renders loading, not-found, and forbidden-style errors", () => {
    expect(
      renderToStaticMarkup(
        <SaleDetailView
          canViewFinancials={false}
          error={null}
          loading
          onBackToHistory={vi.fn()}
          onNewSale={vi.fn()}
          onPrint={vi.fn()}
          sale={null}
        />,
      ),
    ).toContain("Loading sale detail");

    expect(
      renderToStaticMarkup(
        <SaleDetailView
          canViewFinancials={false}
          error="Sale not found."
          loading={false}
          onBackToHistory={vi.fn()}
          onNewSale={vi.fn()}
          onPrint={vi.fn()}
          sale={null}
        />,
      ),
    ).toContain("Sale detail unavailable");

    expect(saleDisplayError({ status: 403 })).toContain("permission");
  });

  it("hides internal cost and gross profit from operational staff receipt view", () => {
    const staffHtml = renderToStaticMarkup(
      <ReceiptView canViewFinancials={false} sale={sale} />,
    );
    const managerHtml = renderToStaticMarkup(
      <ReceiptView canViewFinancials sale={sale} />,
    );

    expect(staffHtml).toContain("Historical Sugar");
    expect(staffHtml).not.toContain("Total cost");
    expect(staffHtml).not.toContain("Gross profit");
    expect(managerHtml).toContain("Total cost");
    expect(managerHtml).toContain("Gross profit");
  });
});
