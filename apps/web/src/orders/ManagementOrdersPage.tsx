import { useState, type FormEvent } from "react";
import { ApiError, apiClient } from "../api/client";
import type { Order, OrderPaymentStatus, OrderStatus } from "../api/types";
import { Alert, EmptyState, LoadingState } from "../components/Feedback";
import { formatMoney, productUnitLabels } from "../products/product-utils";
import {
  formatOrderDate,
  formatOrderQuantity,
  getOrderStatusClass,
  orderPaymentStatusLabels,
  orderStatusLabels,
} from "../customer/order-utils";
import {
  actionDescription,
  actionLabel,
  defaultManagementOrderFilters,
  formatOrderActor,
  formatOrderCustomer,
  getAvailableOrderActions,
  managementOrderError,
  summarizeOrder,
  validateManagementCancelReason,
  type ManagementOrderAction,
  type ManagementOrderFilters,
} from "./management-order-utils";
import {
  useManagementOrderDetail,
  useManagementOrders,
} from "./useManagementOrders";

type MutationState = {
  error: string | null;
  loading: boolean;
  message: string | null;
};

export function ManagementOrdersPage({
  onOpenOrder,
}: {
  onOpenOrder(id: string): void;
}) {
  const { error, filters, loading, orders, setFilters } = useManagementOrders();

  return (
    <ManagementOrdersView
      error={error}
      filters={filters}
      loading={loading}
      onFilterChange={setFilters}
      onOpenOrder={onOpenOrder}
      orders={orders}
    />
  );
}

export function ManagementOrderDetailPage({
  onBackToOrders,
  orderId,
}: {
  onBackToOrders(): void;
  orderId: string | null;
}) {
  const { error, loading, order, reload, setOrder } =
    useManagementOrderDetail(orderId);
  const [dialogAction, setDialogAction] =
    useState<ManagementOrderAction | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [mutation, setMutation] = useState<MutationState>({
    error: null,
    loading: false,
    message: null,
  });

  async function submitAction() {
    if (!order || !dialogAction || mutation.loading) return;
    if (dialogAction === "cancel") {
      const validationError = validateManagementCancelReason(cancelReason);
      if (validationError) {
        setFormError(validationError);
        return;
      }
    }

    setFormError(null);
    setMutation({ error: null, loading: true, message: null });
    try {
      const updatedOrder = await runOrderAction(
        order.id,
        dialogAction,
        cancelReason,
      );
      setOrder(updatedOrder);
      setDialogAction(null);
      setCancelReason("");
      setMutation({
        error: null,
        loading: false,
        message: `${actionLabel(dialogAction)} completed.`,
      });
      void reload();
    } catch (error) {
      const message =
        error instanceof ApiError
          ? managementOrderError(error)
          : "The order action could not be completed. Try again.";
      setMutation({ error: message, loading: false, message: null });
      if (error instanceof ApiError && error.status === 409) {
        void reload();
      }
    }
  }

  return (
    <ManagementOrderDetailView
      cancelReason={cancelReason}
      dialogAction={dialogAction}
      error={error}
      formError={formError}
      loading={loading}
      mutation={mutation}
      onBackToOrders={onBackToOrders}
      onCancelDialog={() => {
        setDialogAction(null);
        setFormError(null);
      }}
      onCancelReasonChange={(reason) => {
        setCancelReason(reason);
        if (formError) setFormError(null);
      }}
      onOpenAction={(action) => {
        setDialogAction(action);
        setFormError(null);
        setMutation({ error: null, loading: false, message: null });
      }}
      onSubmitAction={() => void submitAction()}
      order={order}
    />
  );
}

async function runOrderAction(
  orderId: string,
  action: ManagementOrderAction,
  reason: string,
) {
  if (action === "confirm") {
    return apiClient.confirmOrder(orderId);
  }
  if (action === "verifyPayment") {
    return apiClient.verifyOrderPayment(orderId);
  }
  if (action === "fulfill") {
    return apiClient.fulfillOrder(orderId);
  }
  return apiClient.cancelOrder(orderId, { reason: reason.trim() });
}

export function ManagementOrdersView({
  error,
  filters,
  loading,
  onFilterChange,
  onOpenOrder,
  orders,
}: {
  error: string | null;
  filters: ManagementOrderFilters;
  loading: boolean;
  onFilterChange(filters: ManagementOrderFilters): void;
  onOpenOrder(id: string): void;
  orders: Order[];
}) {
  return (
    <div className="management-orders-grid">
      <section
        className="dashboard-hero sales-history-hero"
        aria-labelledby="management-orders-title"
      >
        <div>
          <p className="eyebrow">Order operations</p>
          <h2 id="management-orders-title">Customer order queue</h2>
          <p>
            Confirm, fulfill, or cancel customer orders without changing payment
            status, inventory, or sales records.
          </p>
        </div>
        <div className="product-note">
          <strong>Operations only</strong>
          <span>
            Fulfillment here does not create a Sale or stock movement.
          </span>
        </div>
      </section>

      <section className="panel" aria-label="Order filters">
        <ManagementOrderFiltersView
          filters={filters}
          onFilterChange={onFilterChange}
        />
      </section>

      <section className="panel" aria-labelledby="management-order-list-title">
        <div className="panel-heading">
          <p className="eyebrow">Customer orders</p>
          <h3 id="management-order-list-title">Operational list</h3>
        </div>
        {loading ? (
          <LoadingState message="Loading customer orders" />
        ) : error ? (
          <Alert title="Orders unavailable">{error}</Alert>
        ) : orders.length === 0 ? (
          <EmptyState title="No matching orders">
            <p>Clear filters or adjust the date range to find orders.</p>
          </EmptyState>
        ) : (
          <ManagementOrderList orders={orders} onOpenOrder={onOpenOrder} />
        )}
      </section>
    </div>
  );
}

function ManagementOrderFiltersView({
  filters,
  onFilterChange,
}: {
  filters: ManagementOrderFilters;
  onFilterChange(filters: ManagementOrderFilters): void;
}) {
  return (
    <div className="management-order-filters">
      <label>
        <span>Order status</span>
        <select
          onChange={(event) =>
            onFilterChange({
              ...filters,
              status: isOrderStatus(event.target.value)
                ? event.target.value
                : "",
            })
          }
          value={filters.status}
        >
          <option value="">All order statuses</option>
          <option value="PENDING">Pending</option>
          <option value="CONFIRMED">Confirmed</option>
          <option value="FULFILLED">Fulfilled</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
      </label>
      <label>
        <span>Payment status</span>
        <select
          onChange={(event) =>
            onFilterChange({
              ...filters,
              paymentStatus: isOrderPaymentStatus(event.target.value)
                ? event.target.value
                : "",
            })
          }
          value={filters.paymentStatus}
        >
          <option value="">All payment statuses</option>
          <option value="UNPAID">Unpaid</option>
          <option value="PAID">Paid</option>
          <option value="FAILED">Failed</option>
        </select>
      </label>
      <label>
        <span>Customer ID</span>
        <input
          onChange={(event) =>
            onFilterChange({ ...filters, customerId: event.target.value })
          }
          placeholder="Customer ID"
          type="search"
          value={filters.customerId}
        />
      </label>
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
      <button
        className="button button--quiet fit-content"
        onClick={() => onFilterChange(defaultManagementOrderFilters)}
        type="button"
      >
        Clear filters
      </button>
    </div>
  );
}

function ManagementOrderList({
  onOpenOrder,
  orders,
}: {
  onOpenOrder(id: string): void;
  orders: Order[];
}) {
  return (
    <div className="management-order-list">
      {orders.map((order) => {
        const summary = summarizeOrder(order);
        return (
          <article className="management-order-row" key={order.id}>
            <div>
              <strong>{order.reference}</strong>
              <span>{summary.createdAt}</span>
            </div>
            <div>
              <span className={`status-badge ${getOrderStatusClass(order)}`}>
                {summary.status}
              </span>
              <span className="status-badge status-badge--IN_STOCK">
                {summary.paymentStatus}
              </span>
            </div>
            <dl>
              <div>
                <dt>Customer</dt>
                <dd>{summary.customer}</dd>
              </div>
              <div>
                <dt>Items</dt>
                <dd>
                  {summary.itemCount} lines · {summary.quantity} total
                </dd>
              </div>
              <div>
                <dt>Subtotal</dt>
                <dd>{formatMoney(order.subtotal)}</dd>
              </div>
            </dl>
            <button
              className="button button--quiet"
              onClick={() => onOpenOrder(order.id)}
              type="button"
            >
              Manage {order.reference}
            </button>
          </article>
        );
      })}
    </div>
  );
}

export function ManagementOrderDetailView({
  cancelReason = "",
  dialogAction = null,
  error,
  formError = null,
  loading,
  mutation = { error: null, loading: false, message: null },
  onBackToOrders,
  onCancelDialog = () => undefined,
  onCancelReasonChange = () => undefined,
  onOpenAction = () => undefined,
  onSubmitAction = () => undefined,
  order,
}: {
  cancelReason?: string;
  dialogAction?: ManagementOrderAction | null;
  error: string | null;
  formError?: string | null;
  loading: boolean;
  mutation?: MutationState;
  onBackToOrders(): void;
  onCancelDialog?: () => void;
  onCancelReasonChange?: (reason: string) => void;
  onOpenAction?: (action: ManagementOrderAction) => void;
  onSubmitAction?: () => void;
  order: Order | null;
}) {
  if (loading) {
    return <LoadingState message="Loading order detail" />;
  }
  if (error) {
    return (
      <section className="panel">
        <Alert title="Order detail unavailable">{error}</Alert>
        <button
          className="button button--quiet"
          onClick={onBackToOrders}
          type="button"
        >
          Back to orders
        </button>
      </section>
    );
  }
  if (!order) {
    return (
      <section className="panel">
        <EmptyState title="Order not found" />
      </section>
    );
  }

  const actions = getAvailableOrderActions(order);

  return (
    <div className="management-order-detail-grid">
      <section
        className="dashboard-hero sales-history-hero"
        aria-labelledby="management-order-detail-title"
      >
        <div>
          <p className="eyebrow">Order detail</p>
          <div className="sale-title-line">
            <h2 id="management-order-detail-title">{order.reference}</h2>
            <span className={`status-badge ${getOrderStatusClass(order)}`}>
              {orderStatusLabels[order.status]}
            </span>
          </div>
          <p>
            Lifecycle actions update only the customer order state. Payment,
            inventory, and sales finalization remain separate workflows.
          </p>
        </div>
        <div className="sale-detail-actions">
          <button
            className="button button--quiet"
            onClick={onBackToOrders}
            type="button"
          >
            Orders
          </button>
          {actions.map((action) => (
            <button
              className={
                action === "cancel"
                  ? "button button--danger"
                  : "button button--primary"
              }
              disabled={mutation.loading}
              key={action}
              onClick={() => onOpenAction(action)}
              type="button"
            >
              {actionLabel(action)}
            </button>
          ))}
        </div>
      </section>

      {mutation.message ? (
        <Alert title="Order updated" variant="info">
          {mutation.message}
        </Alert>
      ) : null}
      {mutation.error ? (
        <Alert title="Order action failed">{mutation.error}</Alert>
      ) : null}

      <section className="panel order-operations-note">
        <p className="eyebrow">Operational boundary</p>
        <p>
          Payment verification is manual management acknowledgement only.
          Fulfillment here does not decrement inventory, create stock movements,
          process providers, or create a Sale.
        </p>
      </section>

      <section className="panel" aria-labelledby="order-audit-heading">
        <div className="panel-heading">
          <p className="eyebrow">Lifecycle</p>
          <h3 id="order-audit-heading">Order status and audit</h3>
        </div>
        <OrderAuditSummary order={order} />
      </section>

      <OrderItemsSnapshot order={order} />

      {dialogAction ? (
        <OrderActionDialog
          action={dialogAction}
          cancelReason={cancelReason}
          formError={formError}
          loading={mutation.loading}
          onCancel={onCancelDialog}
          onCancelReasonChange={onCancelReasonChange}
          onSubmit={onSubmitAction}
          order={order}
        />
      ) : null}
    </div>
  );
}

function OrderAuditSummary({ order }: { order: Order }) {
  return (
    <dl className="order-audit-grid">
      <div>
        <dt>Customer</dt>
        <dd>{formatOrderCustomer(order)}</dd>
      </div>
      <div>
        <dt>Created</dt>
        <dd>{formatOrderDate(order.createdAt)}</dd>
      </div>
      <div>
        <dt>Order status</dt>
        <dd>{orderStatusLabels[order.status]}</dd>
      </div>
      <div>
        <dt>Payment status</dt>
        <dd>{orderPaymentStatusLabels[order.paymentStatus]}</dd>
      </div>
      {order.confirmedAt ? (
        <>
          <div>
            <dt>Confirmed</dt>
            <dd>{formatOrderDate(order.confirmedAt)}</dd>
          </div>
          <div>
            <dt>Confirmed by</dt>
            <dd>{formatOrderActor(order.confirmedBy, order.confirmedById)}</dd>
          </div>
        </>
      ) : null}
      {order.paidAt ? (
        <>
          <div>
            <dt>Payment verified</dt>
            <dd>{formatOrderDate(order.paidAt)}</dd>
          </div>
          <div>
            <dt>Payment verified by</dt>
            <dd>{formatOrderActor(order.paidBy, order.paidById)}</dd>
          </div>
        </>
      ) : null}
      {order.fulfilledAt ? (
        <>
          <div>
            <dt>Fulfilled</dt>
            <dd>{formatOrderDate(order.fulfilledAt)}</dd>
          </div>
          <div>
            <dt>Fulfilled by</dt>
            <dd>{formatOrderActor(order.fulfilledBy, order.fulfilledById)}</dd>
          </div>
        </>
      ) : null}
      {order.cancelledAt ? (
        <>
          <div>
            <dt>Cancelled</dt>
            <dd>{formatOrderDate(order.cancelledAt)}</dd>
          </div>
          <div>
            <dt>Cancelled by</dt>
            <dd>{formatOrderActor(order.cancelledBy, order.cancelledById)}</dd>
          </div>
        </>
      ) : null}
      {order.cancelReason ? (
        <div className="order-audit-wide">
          <dt>Cancellation reason</dt>
          <dd>{order.cancelReason}</dd>
        </div>
      ) : null}
    </dl>
  );
}

function OrderItemsSnapshot({ order }: { order: Order }) {
  return (
    <section className="panel" aria-labelledby="order-items-heading">
      <div className="panel-heading">
        <p className="eyebrow">Snapshot</p>
        <h3 id="order-items-heading">Order items</h3>
      </div>
      <div className="sales-history-table-wrap">
        <table className="sales-history-table">
          <thead>
            <tr>
              <th scope="col">Product</th>
              <th scope="col">Unit</th>
              <th scope="col">Quantity</th>
              <th scope="col">Price</th>
              <th scope="col">Line subtotal</th>
            </tr>
          </thead>
          <tbody>
            {(order.items ?? []).map((item) => (
              <tr key={item.id}>
                <td>
                  <strong>{item.productName}</strong>
                  <span>Code {item.productSku}</span>
                </td>
                <td>{productUnitLabels[item.productUnit]}</td>
                <td>{formatOrderQuantity(item.quantity)}</td>
                <td>{formatMoney(item.unitPrice)}</td>
                <td>{formatMoney(item.lineSubtotal)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th colSpan={4} scope="row">
                Order subtotal
              </th>
              <td>{formatMoney(order.subtotal)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}

export function OrderActionDialog({
  action,
  cancelReason,
  formError,
  loading,
  onCancel,
  onCancelReasonChange,
  onSubmit,
  order,
}: {
  action: ManagementOrderAction;
  cancelReason: string;
  formError?: string | null;
  loading: boolean;
  onCancel(): void;
  onCancelReasonChange(reason: string): void;
  onSubmit(): void;
  order: Order;
}) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit();
  }

  return (
    <section
      aria-labelledby="order-action-title"
      aria-modal="true"
      className="confirm-backdrop"
      role="dialog"
    >
      <form className="confirm-dialog" onSubmit={submit}>
        <p className="eyebrow">Order action</p>
        <h3 id="order-action-title">{actionLabel(action)}</h3>
        <p>{actionDescription(action, order)}</p>
        {action === "cancel" ? (
          <label>
            <span>Cancellation reason</span>
            <textarea
              aria-describedby={formError ? "order-action-error" : undefined}
              maxLength={500}
              onChange={(event) => onCancelReasonChange(event.target.value)}
              rows={4}
              value={cancelReason}
            />
          </label>
        ) : null}
        {formError ? (
          <span className="field-error" id="order-action-error">
            {formError}
          </span>
        ) : null}
        {action === "cancel" ? (
          <span className="field-help">
            {cancelReason.trim().length}/500 characters
          </span>
        ) : null}
        <div className="confirm-actions">
          <button
            className="button button--quiet"
            disabled={loading}
            onClick={onCancel}
            type="button"
          >
            Keep current status
          </button>
          <button
            className={
              action === "cancel"
                ? "button button--danger"
                : "button button--primary"
            }
            disabled={loading}
            type="submit"
          >
            {loading ? "Updating order" : actionLabel(action)}
          </button>
        </div>
      </form>
    </section>
  );
}

function isOrderStatus(value: string): value is OrderStatus {
  return (
    value === "PENDING" ||
    value === "CONFIRMED" ||
    value === "CANCELLED" ||
    value === "FULFILLED"
  );
}

function isOrderPaymentStatus(value: string): value is OrderPaymentStatus {
  return value === "UNPAID" || value === "PAID" || value === "FAILED";
}
