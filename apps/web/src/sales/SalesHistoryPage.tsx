import type { Sale } from "../api/types";
import { hasPermission, permissions } from "../auth/permissions";
import { useAuth } from "../auth/useAuth";
import { Alert, EmptyState, LoadingState } from "../components/Feedback";
import { Logo } from "../components/Logo";
import { productUnitLabels } from "../products/product-utils";
import { paymentStatusLabels } from "./pos-utils";
import {
  defaultSalesHistoryFilters,
  formatPaymentStatus,
  formatSaleDate,
  formatSaleMoney,
  formatSaleQuantity,
  getSaleCashier,
  getSaleItemCount,
  type SalesHistoryFilters,
} from "./sales-history-utils";
import { useSaleDetail, useSalesHistory } from "./useSalesHistory";

export function SalesHistoryPage({
  onOpenSale,
}: {
  onOpenSale(id: string): void;
}) {
  const { error, filters, loading, sales, setFilters } = useSalesHistory();

  return (
    <SalesHistoryView
      error={error}
      filters={filters}
      loading={loading}
      onFilterChange={setFilters}
      onOpenSale={onOpenSale}
      sales={sales}
    />
  );
}

export function SaleDetailPage({
  onBackToHistory,
  onNewSale,
  saleId,
}: {
  onBackToHistory(): void;
  onNewSale(): void;
  saleId: string | null;
}) {
  const auth = useAuth();
  const { error, loading, sale } = useSaleDetail(saleId);
  const canViewFinancials = hasPermission(auth.user, permissions.READ_REPORTS);

  return (
    <SaleDetailView
      canViewFinancials={canViewFinancials}
      error={error}
      loading={loading}
      onBackToHistory={onBackToHistory}
      onNewSale={onNewSale}
      onPrint={() => window.print()}
      sale={sale}
    />
  );
}

export function SalesHistoryView({
  error,
  filters,
  loading,
  onFilterChange,
  onOpenSale,
  sales,
}: {
  error: string | null;
  filters: SalesHistoryFilters;
  loading: boolean;
  onFilterChange(filters: SalesHistoryFilters): void;
  onOpenSale(id: string): void;
  sales: Sale[];
}) {
  return (
    <div className="sales-history-grid">
      <section
        className="dashboard-hero sales-history-hero"
        aria-labelledby="sales-history-title"
      >
        <div>
          <p className="eyebrow">Sales history</p>
          <h2 id="sales-history-title">Transactions and receipts</h2>
          <p>
            Review persisted sales, open receipt details, and print a clean
            receipt without changing the completed transaction.
          </p>
        </div>
        <div className="product-note">
          <strong>Historical sale data</strong>
          <span>Receipts use SaleItem snapshots stored at checkout.</span>
        </div>
      </section>

      <section className="panel" aria-label="Sales history filters">
        <SalesHistoryFiltersView
          filters={filters}
          onFilterChange={onFilterChange}
        />
      </section>

      <section className="panel" aria-labelledby="sales-list-heading">
        <div className="panel-heading">
          <p className="eyebrow">Transactions</p>
          <h3 id="sales-list-heading">Recent sales</h3>
        </div>
        {loading ? (
          <LoadingState message="Loading sales history" />
        ) : error ? (
          <Alert title="Sales unavailable">{error}</Alert>
        ) : sales.length === 0 ? (
          <EmptyState title="No sales found">
            <p>Try adjusting the date range or payment status.</p>
          </EmptyState>
        ) : (
          <SalesHistoryTable onOpenSale={onOpenSale} sales={sales} />
        )}
      </section>
    </div>
  );
}

function SalesHistoryFiltersView({
  filters,
  onFilterChange,
}: {
  filters: SalesHistoryFilters;
  onFilterChange(filters: SalesHistoryFilters): void;
}) {
  return (
    <div className="sales-history-filters">
      <label>
        <span>From</span>
        <input
          onChange={(event) =>
            onFilterChange({ ...filters, from: event.target.value })
          }
          type="date"
          value={filters.from}
        />
      </label>
      <label>
        <span>To</span>
        <input
          onChange={(event) =>
            onFilterChange({ ...filters, to: event.target.value })
          }
          type="date"
          value={filters.to}
        />
      </label>
      <label>
        <span>Payment status</span>
        <select
          onChange={(event) =>
            onFilterChange({
              ...filters,
              paymentStatus:
                event.target.value === "PAID" ||
                event.target.value === "PENDING"
                  ? event.target.value
                  : "",
            })
          }
          value={filters.paymentStatus}
        >
          <option value="">All payment statuses</option>
          <option value="PAID">Paid</option>
          <option value="PENDING">Pending</option>
        </select>
      </label>
      <label>
        <span>Limit</span>
        <select
          onChange={(event) =>
            onFilterChange({ ...filters, limit: Number(event.target.value) })
          }
          value={filters.limit}
        >
          {[10, 25, 50, 100].map((limit) => (
            <option key={limit} value={limit}>
              {limit} sales
            </option>
          ))}
        </select>
      </label>
      <button
        className="button button--quiet"
        onClick={() => onFilterChange(defaultSalesHistoryFilters)}
        type="button"
      >
        Reset filters
      </button>
    </div>
  );
}

function SalesHistoryTable({
  onOpenSale,
  sales,
}: {
  onOpenSale(id: string): void;
  sales: Sale[];
}) {
  return (
    <div className="sales-history-table-wrap">
      <table className="sales-history-table">
        <thead>
          <tr>
            <th scope="col">Reference</th>
            <th scope="col">Date</th>
            <th scope="col">Total</th>
            <th scope="col">Payment</th>
            <th scope="col">Items</th>
            <th scope="col">Cashier</th>
            <th scope="col">Detail</th>
          </tr>
        </thead>
        <tbody>
          {sales.map((sale) => (
            <tr key={sale.id}>
              <td data-label="Reference">
                <strong>{sale.reference}</strong>
              </td>
              <td data-label="Date">{formatSaleDate(sale.soldAt)}</td>
              <td data-label="Total">{formatSaleMoney(sale.totalAmount)}</td>
              <td data-label="Payment">
                <span className="status-badge status-badge--IN_STOCK">
                  {formatPaymentStatus(sale)}
                </span>
              </td>
              <td data-label="Items">{getSaleItemCount(sale)}</td>
              <td data-label="Cashier">{getSaleCashier(sale)}</td>
              <td data-label="Detail">
                <button
                  className="button button--quiet"
                  onClick={() => onOpenSale(sale.id)}
                  type="button"
                >
                  View {sale.reference}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function SaleDetailView({
  canViewFinancials,
  error,
  loading,
  onBackToHistory,
  onNewSale,
  onPrint,
  sale,
}: {
  canViewFinancials: boolean;
  error: string | null;
  loading: boolean;
  onBackToHistory(): void;
  onNewSale(): void;
  onPrint(): void;
  sale: Sale | null;
}) {
  if (loading) {
    return <LoadingState message="Loading sale detail" />;
  }
  if (error) {
    return (
      <section className="panel">
        <Alert title="Sale detail unavailable">{error}</Alert>
        <button
          className="button button--quiet"
          onClick={onBackToHistory}
          type="button"
        >
          Back to sales history
        </button>
      </section>
    );
  }
  if (!sale) {
    return (
      <section className="panel">
        <EmptyState title="Sale not found" />
      </section>
    );
  }

  return (
    <div className="sale-detail-grid">
      <section
        className="dashboard-hero sales-history-hero no-print"
        aria-labelledby="sale-detail-title"
      >
        <div>
          <p className="eyebrow">Sale detail</p>
          <h2 id="sale-detail-title">{sale.reference}</h2>
          <p>
            Persisted receipt detail from checkout. Item names, units, and
            prices come from the sale snapshot.
          </p>
        </div>
        <div className="sale-detail-actions">
          <button
            className="button button--quiet"
            onClick={onBackToHistory}
            type="button"
          >
            Sales history
          </button>
          <button
            className="button button--quiet"
            onClick={onNewSale}
            type="button"
          >
            New sale
          </button>
          <button
            className="button button--primary"
            onClick={onPrint}
            type="button"
          >
            Print receipt
          </button>
        </div>
      </section>

      <ReceiptView canViewFinancials={canViewFinancials} sale={sale} />
    </div>
  );
}

export function ReceiptView({
  canViewFinancials,
  sale,
}: {
  canViewFinancials: boolean;
  sale: Sale;
}) {
  return (
    <article className="receipt-print-area" aria-labelledby="receipt-title">
      <header className="receipt-header">
        <Logo />
        <div>
          <p className="eyebrow">Receipt</p>
          <h3 id="receipt-title">{sale.reference}</h3>
          <p>{formatSaleDate(sale.soldAt)}</p>
        </div>
      </header>

      <dl className="receipt-meta">
        <div>
          <dt>Payment status</dt>
          <dd>{paymentStatusLabels[sale.paymentStatus]}</dd>
        </div>
        <div>
          <dt>Payment method</dt>
          <dd>{sale.paymentMethod}</dd>
        </div>
        <div>
          <dt>Cashier</dt>
          <dd>{getSaleCashier(sale)}</dd>
        </div>
        {sale.paymentReference ? (
          <div>
            <dt>Payment reference</dt>
            <dd>{sale.paymentReference}</dd>
          </div>
        ) : null}
      </dl>

      <table className="receipt-items">
        <thead>
          <tr>
            <th scope="col">Item</th>
            <th scope="col">Qty</th>
            <th scope="col">Price</th>
            <th scope="col">Line total</th>
            {canViewFinancials ? <th scope="col">Cost</th> : null}
            {canViewFinancials ? <th scope="col">Gross profit</th> : null}
          </tr>
        </thead>
        <tbody>
          {(sale.items ?? []).map((item) => (
            <tr key={item.id}>
              <td>
                <strong>{item.productName}</strong>
                <span>{productUnitLabels[item.productUnit]}</span>
              </td>
              <td>{formatSaleQuantity(item.quantity)}</td>
              <td>{formatSaleMoney(item.unitPrice)}</td>
              <td>{formatSaleMoney(item.lineTotal)}</td>
              {canViewFinancials ? (
                <td>{formatSaleMoney(item.lineCost)}</td>
              ) : null}
              {canViewFinancials ? (
                <td>{formatSaleMoney(item.grossProfit)}</td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>

      <dl className="receipt-totals">
        <div>
          <dt>Subtotal</dt>
          <dd>{formatSaleMoney(sale.subtotal)}</dd>
        </div>
        <div>
          <dt>Discount</dt>
          <dd>{formatSaleMoney(sale.discountAmount)}</dd>
        </div>
        <div>
          <dt>Total</dt>
          <dd>{formatSaleMoney(sale.totalAmount)}</dd>
        </div>
        {canViewFinancials ? (
          <div>
            <dt>Total cost</dt>
            <dd>{formatSaleMoney(sale.totalCost)}</dd>
          </div>
        ) : null}
        {canViewFinancials ? (
          <div>
            <dt>Gross profit</dt>
            <dd>{formatSaleMoney(sale.grossProfit)}</dd>
          </div>
        ) : null}
      </dl>

      <footer className="receipt-footer">
        <p>Thank you for shopping with Monumental Details.</p>
      </footer>
    </article>
  );
}
