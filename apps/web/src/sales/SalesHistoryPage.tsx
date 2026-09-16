import { useState, type FormEvent } from "react";
import { ApiError, apiClient } from "../api/client";
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
  getSaleStatusClass,
  getSaleCashier,
  getSaleItemCount,
  getVoidedBy,
  saleStatusLabels,
  saleVoidDisplayError,
  validateVoidReason,
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
  const { error, loading, reload, sale, setSale } = useSaleDetail(saleId);
  const canViewFinancials = hasPermission(auth.user, permissions.READ_REPORTS);
  const canVoidSale =
    hasPermission(auth.user, permissions.VOID_SALES) &&
    sale?.status === "COMPLETED";
  const [voidDialogOpen, setVoidDialogOpen] = useState(false);
  const [voidReason, setVoidReason] = useState("");
  const [voidFormError, setVoidFormError] = useState<string | null>(null);
  const [voidMutation, setVoidMutation] = useState<{
    error: string | null;
    loading: boolean;
    message: string | null;
  }>({ error: null, loading: false, message: null });

  async function submitVoidSale() {
    if (!sale) return;
    const validationError = validateVoidReason(voidReason);
    if (validationError) {
      setVoidFormError(validationError);
      return;
    }

    setVoidFormError(null);
    setVoidMutation({ error: null, loading: true, message: null });
    try {
      const voidedSale = await apiClient.voidSale(sale.id, {
        reason: voidReason.trim(),
      });
      setSale(voidedSale);
      setVoidDialogOpen(false);
      setVoidReason("");
      setVoidMutation({
        error: null,
        loading: false,
        message: "Sale voided and inventory restoration recorded.",
      });
      void reload();
    } catch (error) {
      setVoidMutation({
        error:
          error instanceof ApiError
            ? saleVoidDisplayError(error)
            : "Sale could not be voided. Try again.",
        loading: false,
        message: null,
      });
    }
  }

  return (
    <SaleDetailView
      canVoidSale={canVoidSale}
      canViewFinancials={canViewFinancials}
      error={error}
      loading={loading}
      onBackToHistory={onBackToHistory}
      onCancelVoid={() => {
        setVoidDialogOpen(false);
        setVoidFormError(null);
      }}
      onNewSale={onNewSale}
      onOpenVoid={() => {
        setVoidDialogOpen(true);
        setVoidMutation({ error: null, loading: false, message: null });
      }}
      onPrint={() => window.print()}
      onSubmitVoidSale={() => void submitVoidSale()}
      onVoidReasonChange={(reason) => {
        setVoidReason(reason);
        if (voidFormError) {
          setVoidFormError(null);
        }
      }}
      sale={sale}
      voidDialogOpen={voidDialogOpen}
      voidFormError={voidFormError}
      voidMutation={voidMutation}
      voidReason={voidReason}
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
        <span>Sale status</span>
        <select
          onChange={(event) =>
            onFilterChange({
              ...filters,
              status:
                event.target.value === "COMPLETED" ||
                event.target.value === "VOIDED"
                  ? event.target.value
                  : "",
            })
          }
          value={filters.status}
        >
          <option value="">All sale statuses</option>
          <option value="COMPLETED">Completed</option>
          <option value="VOIDED">Voided</option>
        </select>
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
            <th scope="col">Status</th>
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
            <tr
              className={
                sale.status === "VOIDED" ? "sales-history-row--voided" : ""
              }
              key={sale.id}
            >
              <td data-label="Reference">
                <strong>{sale.reference}</strong>
              </td>
              <td data-label="Status">
                <span className={`status-badge ${getSaleStatusClass(sale)}`}>
                  {saleStatusLabels[sale.status]}
                </span>
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
  canVoidSale = false,
  canViewFinancials,
  error,
  loading,
  onBackToHistory,
  onCancelVoid = () => undefined,
  onNewSale,
  onOpenVoid = () => undefined,
  onPrint,
  onSubmitVoidSale = () => undefined,
  onVoidReasonChange = () => undefined,
  sale,
  voidDialogOpen = false,
  voidFormError = null,
  voidMutation = { error: null, loading: false, message: null },
  voidReason = "",
}: {
  canVoidSale?: boolean;
  canViewFinancials: boolean;
  error: string | null;
  loading: boolean;
  onBackToHistory(): void;
  onCancelVoid?: () => void;
  onNewSale(): void;
  onOpenVoid?: () => void;
  onPrint(): void;
  onSubmitVoidSale?: () => void;
  onVoidReasonChange?: (reason: string) => void;
  sale: Sale | null;
  voidDialogOpen?: boolean;
  voidFormError?: string | null;
  voidMutation?: {
    error: string | null;
    loading: boolean;
    message: string | null;
  };
  voidReason?: string;
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
          <div className="sale-title-line">
            <h2 id="sale-detail-title">{sale.reference}</h2>
            <span className={`status-badge ${getSaleStatusClass(sale)}`}>
              {saleStatusLabels[sale.status]}
            </span>
          </div>
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
          {canVoidSale ? (
            <button
              className="button button--danger"
              onClick={onOpenVoid}
              type="button"
            >
              Void sale
            </button>
          ) : null}
          <button
            className="button button--primary"
            onClick={onPrint}
            type="button"
          >
            Print receipt
          </button>
        </div>
      </section>

      {voidMutation.message ? (
        <Alert title="Sale operation complete" variant="info">
          {voidMutation.message}
        </Alert>
      ) : null}
      {voidMutation.error ? (
        <Alert title="Sale operation failed">{voidMutation.error}</Alert>
      ) : null}

      {sale.status === "VOIDED" ? <VoidedSaleNotice sale={sale} /> : null}

      <ReceiptView canViewFinancials={canViewFinancials} sale={sale} />

      {voidDialogOpen ? (
        <VoidSaleDialog
          formError={voidFormError}
          loading={voidMutation.loading}
          onCancel={onCancelVoid}
          onReasonChange={onVoidReasonChange}
          onSubmit={onSubmitVoidSale}
          reason={voidReason}
          sale={sale}
        />
      ) : null}
    </div>
  );
}

function VoidedSaleNotice({ sale }: { sale: Sale }) {
  return (
    <section className="panel voided-sale-notice" aria-label="Void information">
      <div>
        <p className="eyebrow">Later void action</p>
        <h3>Sale voided</h3>
      </div>
      <dl className="receipt-meta">
        <div>
          <dt>Void reason</dt>
          <dd>{sale.voidReason ?? "No reason provided"}</dd>
        </div>
        <div>
          <dt>Voided at</dt>
          <dd>{sale.voidedAt ? formatSaleDate(sale.voidedAt) : "Unknown"}</dd>
        </div>
        <div>
          <dt>Voided by</dt>
          <dd>{getVoidedBy(sale)}</dd>
        </div>
      </dl>
      <p>
        The original transaction and item snapshots remain preserved for audit.
        Inventory restoration was recorded by the backend.
      </p>
    </section>
  );
}

export function VoidSaleDialog({
  formError,
  loading,
  onCancel,
  onReasonChange,
  onSubmit,
  reason,
  sale,
}: {
  formError: string | null;
  loading: boolean;
  onCancel(): void;
  onReasonChange(reason: string): void;
  onSubmit(): void;
  reason: string;
  sale: Sale;
}) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit();
  }

  return (
    <section
      aria-labelledby="void-sale-title"
      aria-modal="true"
      className="confirm-backdrop no-print"
      role="dialog"
    >
      <form className="confirm-dialog void-sale-dialog" onSubmit={submit}>
        <p className="eyebrow">Void sale</p>
        <h3 id="void-sale-title">{sale.reference}</h3>
        <p>
          This will void the sale, restore its inventory, and remove it from
          normal completed-sales reporting. This is not an external
          payment-provider refund.
        </p>
        <label>
          <span>Reason</span>
          <textarea
            aria-describedby={formError ? "void-reason-error" : undefined}
            maxLength={500}
            onChange={(event) => onReasonChange(event.target.value)}
            required
            rows={4}
            value={reason}
          />
        </label>
        <span className="field-help">
          {reason.trim().length}/500 characters
        </span>
        {formError ? (
          <span className="field-error" id="void-reason-error" role="alert">
            {formError}
          </span>
        ) : null}
        <div className="confirm-actions">
          <button
            className="button button--quiet"
            disabled={loading}
            onClick={onCancel}
            type="button"
          >
            Cancel
          </button>
          <button
            className="button button--danger"
            disabled={loading}
            type="submit"
          >
            {loading ? "Voiding sale" : "Void sale"}
          </button>
        </div>
      </form>
    </section>
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
          <div className="receipt-title-line">
            <h3 id="receipt-title">{sale.reference}</h3>
            <span className={`status-badge ${getSaleStatusClass(sale)}`}>
              {saleStatusLabels[sale.status]}
            </span>
          </div>
          <p>{formatSaleDate(sale.soldAt)}</p>
        </div>
      </header>

      {sale.status === "VOIDED" ? (
        <section className="receipt-void-banner" aria-label="Voided sale">
          <strong>VOIDED</strong>
          <span>
            This receipt preserves the original sale. It is not a
            payment-provider refund record.
          </span>
        </section>
      ) : null}

      <dl className="receipt-meta">
        <div>
          <dt>Sale status</dt>
          <dd>{saleStatusLabels[sale.status]}</dd>
        </div>
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

      {sale.status === "VOIDED" ? (
        <dl className="receipt-meta receipt-void-meta">
          <div>
            <dt>Void reason</dt>
            <dd>{sale.voidReason ?? "No reason provided"}</dd>
          </div>
          <div>
            <dt>Voided at</dt>
            <dd>{sale.voidedAt ? formatSaleDate(sale.voidedAt) : "Unknown"}</dd>
          </div>
          <div>
            <dt>Voided by</dt>
            <dd>{getVoidedBy(sale)}</dd>
          </div>
        </dl>
      ) : null}

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
