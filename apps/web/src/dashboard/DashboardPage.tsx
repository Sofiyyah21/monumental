import { useMemo, useState } from "react";
import type {
  BestSellerReportItem,
  DashboardPeriod,
  LowStockReportItem,
  Sale,
  SalesSummaryReport,
  StockStatus,
} from "../api/types";
import { useAuth } from "../auth/useAuth";
import { Alert, EmptyState, LoadingState } from "../components/Feedback";
import {
  formatDateTime,
  formatMoney,
  formatQuantity,
  periodOptions,
} from "./dashboard-utils";
import {
  type CustomRange,
  type DashboardState,
  useDashboardData,
} from "./useDashboardData";

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

export function DashboardPage() {
  const auth = useAuth();
  const [period, setPeriod] = useState<DashboardPeriod>("today");
  const [draftRange, setDraftRange] = useState<CustomRange>(() => ({
    from: todayInputValue(),
    to: todayInputValue(),
  }));
  const [customRange, setCustomRange] = useState<CustomRange>(draftRange);
  const state = useDashboardData(period, customRange);

  return (
    <DashboardView
      customRange={draftRange}
      isManagerView={auth.role === "MANAGER"}
      onApplyCustomRange={() => setCustomRange(draftRange)}
      onCustomRangeChange={setDraftRange}
      onPeriodChange={setPeriod}
      period={period}
      state={state}
    />
  );
}

export function DashboardView({
  customRange,
  isManagerView,
  onApplyCustomRange,
  onCustomRangeChange,
  onPeriodChange,
  period,
  state,
}: {
  customRange: CustomRange;
  isManagerView: boolean;
  onApplyCustomRange(): void;
  onCustomRangeChange(range: CustomRange): void;
  onPeriodChange(period: DashboardPeriod): void;
  period: DashboardPeriod;
  state: DashboardState;
}) {
  const summary = state.data?.summary;
  const bestSellers = state.data?.bestSellers.products ?? [];
  const recentSales = state.data?.recentSales ?? [];
  const lowStock = state.lowStock;
  const hasSales = summary ? summary.salesCount > 0 : false;

  if (state.loading && !state.data) {
    return <LoadingState message="Loading reporting dashboard" />;
  }

  if (state.error && !state.data) {
    return (
      <section className="dashboard-grid">
        <Alert title="Reports unavailable">{state.error}</Alert>
      </section>
    );
  }

  return (
    <div className="dashboard-grid">
      <section className="dashboard-hero" aria-labelledby="dashboard-title">
        <div>
          <p className="eyebrow">
            {isManagerView ? "Manager view" : "Owner view"}
          </p>
          <h2 id="dashboard-title">Shop performance</h2>
          <p>
            Revenue, cost of goods sold, gross profit, product movement, and
            stock attention for the selected period.
          </p>
        </div>
        <PeriodSelector
          customRange={customRange}
          onApplyCustomRange={onApplyCustomRange}
          onCustomRangeChange={onCustomRangeChange}
          onPeriodChange={onPeriodChange}
          period={period}
        />
      </section>

      {state.loading ? (
        <div className="inline-status" role="status" aria-live="polite">
          Updating dashboard
        </div>
      ) : null}
      {state.error ? (
        <Alert title="Reports could not refresh" variant="error">
          {state.error}
        </Alert>
      ) : null}

      {summary ? <KpiSummary summary={summary} /> : null}

      <section className="dashboard-main" aria-label="Dashboard details">
        <BestSellersPanel products={bestSellers} />
        <LowStockPanel
          error={state.lowStockError}
          loading={state.lowStockLoading}
          products={lowStock}
        />
        <RecentSalesPanel hasSales={hasSales} sales={recentSales} />
      </section>
    </div>
  );
}

function PeriodSelector({
  customRange,
  onApplyCustomRange,
  onCustomRangeChange,
  onPeriodChange,
  period,
}: {
  customRange: CustomRange;
  onApplyCustomRange(): void;
  onCustomRangeChange(range: CustomRange): void;
  onPeriodChange(period: DashboardPeriod): void;
  period: DashboardPeriod;
}) {
  return (
    <div className="period-control" aria-label="Reporting period">
      <div className="segmented-control" role="group" aria-label="Period">
        {periodOptions.map((option) => (
          <button
            aria-pressed={period === option.value}
            className={
              period === option.value
                ? "segment-button active"
                : "segment-button"
            }
            key={option.value}
            onClick={() => onPeriodChange(option.value)}
            type="button"
          >
            {option.label}
          </button>
        ))}
      </div>

      {period === "custom" ? (
        <form
          className="custom-range"
          onSubmit={(event) => {
            event.preventDefault();
            onApplyCustomRange();
          }}
        >
          <label>
            <span>From</span>
            <input
              max={customRange.to}
              onChange={(event) =>
                onCustomRangeChange({
                  ...customRange,
                  from: event.target.value,
                })
              }
              type="date"
              value={customRange.from}
            />
          </label>
          <label>
            <span>To</span>
            <input
              min={customRange.from}
              onChange={(event) =>
                onCustomRangeChange({
                  ...customRange,
                  to: event.target.value,
                })
              }
              type="date"
              value={customRange.to}
            />
          </label>
          <button className="button button--primary" type="submit">
            Apply
          </button>
        </form>
      ) : null}
    </div>
  );
}

function KpiSummary({ summary }: { summary: SalesSummaryReport }) {
  const grossProfitPositive = Number(summary.grossProfit) >= 0;
  const kpis = useMemo(
    () => [
      { label: "Sales", value: summary.salesCount.toString(), tone: "neutral" },
      {
        label: "Units sold",
        value: formatQuantity(summary.unitsSold),
        tone: "neutral",
      },
      {
        label: "Revenue",
        value: formatMoney(summary.revenue),
        tone: "brand",
      },
      { label: "COGS", value: formatMoney(summary.cogs), tone: "neutral" },
      {
        label: "Gross profit",
        value: formatMoney(summary.grossProfit),
        tone: grossProfitPositive ? "profit" : "loss",
      },
      {
        label: "Discounts",
        value: formatMoney(summary.discounts),
        tone: "neutral",
      },
      {
        label: "Average sale",
        value: formatMoney(summary.averageSaleValue),
        tone: "neutral",
      },
    ],
    [grossProfitPositive, summary],
  );

  return (
    <section className="kpi-grid" aria-label="Current period performance">
      {kpis.map((kpi) => (
        <article className={`kpi-item kpi-item--${kpi.tone}`} key={kpi.label}>
          <span>{kpi.label}</span>
          <strong>{kpi.value}</strong>
        </article>
      ))}
    </section>
  );
}

function BestSellersPanel({ products }: { products: BestSellerReportItem[] }) {
  return (
    <section className="panel panel--wide" aria-labelledby="best-sellers-title">
      <div className="panel-heading">
        <p className="eyebrow">Quantity sold</p>
        <h3 id="best-sellers-title">Best sellers</h3>
      </div>
      {products.length === 0 ? (
        <EmptyState title="No product sales yet">
          <p>Completed sales for this period will appear here.</p>
        </EmptyState>
      ) : (
        <ol className="rank-list">
          {products.map((product) => (
            <li key={`${product.productId}-${product.productName}`}>
              <span className="rank-number">{product.rank}</span>
              <div>
                <strong>{product.productName}</strong>
                <span>
                  {formatQuantity(product.quantitySold)}{" "}
                  {product.unit.toLowerCase()}
                </span>
              </div>
              <dl>
                <div>
                  <dt>Revenue</dt>
                  <dd>{formatMoney(product.revenue)}</dd>
                </div>
                <div>
                  <dt>Gross profit</dt>
                  <dd>{formatMoney(product.grossProfit)}</dd>
                </div>
              </dl>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function LowStockPanel({
  error,
  loading,
  products,
}: {
  error: string | null;
  loading: boolean;
  products: LowStockReportItem[];
}) {
  return (
    <section className="panel" aria-labelledby="low-stock-title">
      <div className="panel-heading">
        <p className="eyebrow">Inventory</p>
        <h3 id="low-stock-title">Stock attention</h3>
      </div>
      {loading ? (
        <LoadingState message="Checking stock" />
      ) : error ? (
        <Alert title="Stock list unavailable">{error}</Alert>
      ) : products.length === 0 ? (
        <EmptyState title="Stock levels look steady">
          <p>No low-stock or out-of-stock products were returned.</p>
        </EmptyState>
      ) : (
        <ul className="stock-list">
          {products.slice(0, 6).map((product) => (
            <li key={product.productId}>
              <div>
                <strong>{product.name}</strong>
                <span>
                  {formatQuantity(product.currentStock)} / reorder{" "}
                  {formatQuantity(product.reorderLevel)}{" "}
                  {product.unit.toLowerCase()}
                </span>
              </div>
              <StatusBadge status={product.stockStatus} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function RecentSalesPanel({
  hasSales,
  sales,
}: {
  hasSales: boolean;
  sales: Sale[];
}) {
  return (
    <section className="panel" aria-labelledby="recent-sales-title">
      <div className="panel-heading">
        <p className="eyebrow">Completed sales</p>
        <h3 id="recent-sales-title">Recent sales</h3>
      </div>
      {!hasSales ? (
        <EmptyState title="No sales in this period">
          <p>Completed sales will update these numbers automatically.</p>
        </EmptyState>
      ) : sales.length === 0 ? (
        <EmptyState title="No recent sales returned" />
      ) : (
        <ul className="sales-list">
          {sales.map((sale) => (
            <li key={sale.id}>
              <div>
                <strong>{sale.reference}</strong>
                <span>{formatDateTime(sale.soldAt)}</span>
              </div>
              <div className="sale-money">
                <strong>{formatMoney(sale.totalAmount)}</strong>
                <span>Gross profit {formatMoney(sale.grossProfit)}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function StatusBadge({ status }: { status: StockStatus }) {
  const label =
    status === "OUT_OF_STOCK"
      ? "Out of stock"
      : status === "LOW_STOCK"
        ? "Low stock"
        : "In stock";

  return (
    <span className={`status-badge status-badge--${status}`}>{label}</span>
  );
}
