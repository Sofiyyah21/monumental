import { useState, type FormEvent } from "react";
import { ApiError, apiClient } from "../api/client";
import type { Order } from "../api/types";
import { Alert, EmptyState, LoadingState } from "../components/Feedback";
import { Logo } from "../components/Logo";
import { formatMoney } from "../products/product-utils";
import { navigate } from "../routing/useBrowserRoute";
import {
  formatOrderDate,
  formatOrderQuantity,
  getOrderItemCount,
  getOrderQuantity,
  getOrderStatusClass,
  isOrderCancellable,
  orderCancelDisplayError,
  orderPaymentStatusLabels,
  orderStatusLabels,
} from "./order-utils";
import { useCustomerOrderDetail, useCustomerOrders } from "./useCustomerOrders";

export function CustomerOrdersPage({
  onOpenOrder,
}: {
  onOpenOrder(id: string): void;
}) {
  const { error, loading, orders } = useCustomerOrders();

  return (
    <CustomerOrdersView
      error={error}
      loading={loading}
      onOpenOrder={onOpenOrder}
      orders={orders}
    />
  );
}

export function CustomerOrderDetailPage({
  onBackToOrders,
  onContinueShopping,
  orderId,
}: {
  onBackToOrders(): void;
  onContinueShopping(): void;
  orderId: string | null;
}) {
  const { error, loading, order, reload, setOrder } =
    useCustomerOrderDetail(orderId);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelMutation, setCancelMutation] = useState<{
    error: string | null;
    loading: boolean;
    message: string | null;
  }>({ error: null, loading: false, message: null });

  async function submitCancellation() {
    if (!order || cancelMutation.loading) return;

    setCancelMutation({ error: null, loading: true, message: null });
    try {
      const cancelledOrder = await apiClient.cancelOrder(order.id, {
        reason: cancelReason.trim() || undefined,
      });
      setOrder(cancelledOrder);
      setCancelDialogOpen(false);
      setCancelReason("");
      setCancelMutation({
        error: null,
        loading: false,
        message: "Order cancelled.",
      });
      void reload();
    } catch (error) {
      setCancelMutation({
        error:
          error instanceof ApiError
            ? orderCancelDisplayError(error)
            : "The order could not be cancelled. Please try again.",
        loading: false,
        message: null,
      });
    }
  }

  return (
    <CustomerOrderDetailView
      cancelDialogOpen={cancelDialogOpen}
      cancelMutation={cancelMutation}
      cancelReason={cancelReason}
      error={error}
      loading={loading}
      onBackToOrders={onBackToOrders}
      onCancelDialog={() => setCancelDialogOpen(false)}
      onCancelReasonChange={setCancelReason}
      onContinueShopping={onContinueShopping}
      onOpenCancel={() => {
        setCancelDialogOpen(true);
        setCancelMutation({ error: null, loading: false, message: null });
      }}
      onSubmitCancel={() => void submitCancellation()}
      order={order}
    />
  );
}

export function CustomerOrdersView({
  error,
  loading,
  onOpenOrder,
  orders,
}: {
  error: string | null;
  loading: boolean;
  onOpenOrder(id: string): void;
  orders: Order[];
}) {
  return (
    <div className="customer-orders-grid">
      <section
        className="dashboard-hero shop-hero"
        aria-labelledby="orders-title"
      >
        <div>
          <p className="eyebrow">My orders</p>
          <h2 id="orders-title">Customer order history</h2>
          <p>
            Review orders placed from your cart. Order totals and item prices
            come from the backend order snapshot.
          </p>
        </div>
        <div className="shop-note">
          <strong>Customer orders</strong>
          <span>Only your own orders are shown here.</span>
        </div>
      </section>

      <section className="panel" aria-labelledby="orders-list-heading">
        <div className="panel-heading">
          <p className="eyebrow">Orders</p>
          <h3 id="orders-list-heading">Recent orders</h3>
        </div>
        {loading ? (
          <LoadingState message="Loading your orders" />
        ) : error ? (
          <Alert title="Orders unavailable">{error}</Alert>
        ) : orders.length === 0 ? (
          <EmptyState title="No orders yet">
            <p>
              Start from the shop catalog and place an order from your cart.
            </p>
            <button
              className="button button--primary fit-content"
              onClick={() => navigate("/shop")}
              type="button"
            >
              Shop products
            </button>
          </EmptyState>
        ) : (
          <OrderList orders={orders} onOpenOrder={onOpenOrder} />
        )}
      </section>
    </div>
  );
}

function OrderList({
  onOpenOrder,
  orders,
}: {
  onOpenOrder(id: string): void;
  orders: Order[];
}) {
  return (
    <div className="customer-orders-list" aria-live="polite">
      {orders.map((order) => (
        <article className="customer-order-row" key={order.id}>
          <div>
            <strong>{order.reference}</strong>
            <span>{formatOrderDate(order.createdAt)}</span>
          </div>
          <span className={`status-badge ${getOrderStatusClass(order)}`}>
            {orderStatusLabels[order.status]}
          </span>
          <span className="status-badge status-badge--IN_STOCK">
            {orderPaymentStatusLabels[order.paymentStatus]}
          </span>
          <dl>
            <div>
              <dt>Subtotal</dt>
              <dd>{formatMoney(order.subtotal)}</dd>
            </div>
            <div>
              <dt>Items</dt>
              <dd>
                {getOrderItemCount(order)} lines ·{" "}
                {formatOrderQuantity(getOrderQuantity(order))} total
              </dd>
            </div>
          </dl>
          <button
            className="button button--quiet"
            onClick={() => onOpenOrder(order.id)}
            type="button"
          >
            View {order.reference}
          </button>
        </article>
      ))}
    </div>
  );
}

export function CustomerOrderDetailView({
  cancelDialogOpen = false,
  cancelMutation = { error: null, loading: false, message: null },
  cancelReason = "",
  error,
  loading,
  onBackToOrders,
  onCancelDialog = () => undefined,
  onCancelReasonChange = () => undefined,
  onContinueShopping,
  onOpenCancel = () => undefined,
  onSubmitCancel = () => undefined,
  order,
}: {
  cancelDialogOpen?: boolean;
  cancelMutation?: {
    error: string | null;
    loading: boolean;
    message: string | null;
  };
  cancelReason?: string;
  error: string | null;
  loading: boolean;
  onBackToOrders(): void;
  onCancelDialog?: () => void;
  onCancelReasonChange?: (reason: string) => void;
  onContinueShopping(): void;
  onOpenCancel?: () => void;
  onSubmitCancel?: () => void;
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
          Back to my orders
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

  return (
    <div className="customer-order-detail-grid">
      <section
        className="dashboard-hero shop-hero"
        aria-labelledby="order-detail-title"
      >
        <div>
          <p className="eyebrow">Order detail</p>
          <div className="sale-title-line">
            <h2 id="order-detail-title">{order.reference}</h2>
            <span className={`status-badge ${getOrderStatusClass(order)}`}>
              {orderStatusLabels[order.status]}
            </span>
          </div>
          <p>
            Persisted customer order detail. Item names, units, and prices come
            from the order snapshot.
          </p>
        </div>
        <div className="sale-detail-actions">
          <button
            className="button button--quiet"
            onClick={onBackToOrders}
            type="button"
          >
            My orders
          </button>
          <button
            className="button button--quiet"
            onClick={onContinueShopping}
            type="button"
          >
            Continue shopping
          </button>
          {isOrderCancellable(order) ? (
            <button
              className="button button--danger"
              disabled={cancelMutation.loading}
              onClick={onOpenCancel}
              type="button"
            >
              Cancel order
            </button>
          ) : null}
        </div>
      </section>

      {cancelMutation.message ? (
        <Alert title="Order updated" variant="info">
          {cancelMutation.message}
        </Alert>
      ) : null}
      {cancelMutation.error ? (
        <Alert title="Order update failed">{cancelMutation.error}</Alert>
      ) : null}

      {order.status === "CANCELLED" ? (
        <section className="panel voided-sale-notice">
          <p className="eyebrow">Order cancelled</p>
          <h3>Cancellation recorded</h3>
          <p>
            {order.cancelReason
              ? `Reason: ${order.cancelReason}`
              : "No cancellation reason was provided."}
          </p>
        </section>
      ) : null}

      <OrderSnapshotView order={order} />

      {cancelDialogOpen ? (
        <CancelOrderDialog
          loading={cancelMutation.loading}
          onCancel={onCancelDialog}
          onReasonChange={onCancelReasonChange}
          onSubmit={onSubmitCancel}
          order={order}
          reason={cancelReason}
        />
      ) : null}
    </div>
  );
}

function OrderSnapshotView({ order }: { order: Order }) {
  return (
    <article className="receipt-print-area customer-order-card">
      <header className="receipt-header">
        <Logo />
        <div>
          <p className="eyebrow">Customer order</p>
          <div className="receipt-title-line">
            <h3>{order.reference}</h3>
            <span className={`status-badge ${getOrderStatusClass(order)}`}>
              {orderStatusLabels[order.status]}
            </span>
          </div>
          <p>{formatOrderDate(order.createdAt)}</p>
        </div>
      </header>

      <dl className="receipt-meta">
        <div>
          <dt>Order status</dt>
          <dd>{orderStatusLabels[order.status]}</dd>
        </div>
        <div>
          <dt>Payment status</dt>
          <dd>{orderPaymentStatusLabels[order.paymentStatus]}</dd>
        </div>
        <div>
          <dt>Order subtotal</dt>
          <dd>{formatMoney(order.subtotal)}</dd>
        </div>
      </dl>

      <table className="receipt-items">
        <thead>
          <tr>
            <th scope="col">Item</th>
            <th scope="col">Qty</th>
            <th scope="col">Price</th>
            <th scope="col">Line subtotal</th>
          </tr>
        </thead>
        <tbody>
          {(order.items ?? []).map((item) => (
            <tr key={item.id}>
              <td>
                <strong>{item.productName}</strong>
                <span>
                  Code {item.productSku} · {item.productUnit.toLowerCase()}
                </span>
              </td>
              <td>{formatOrderQuantity(item.quantity)}</td>
              <td>{formatMoney(item.unitPrice)}</td>
              <td>{formatMoney(item.lineSubtotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </article>
  );
}

export function CancelOrderDialog({
  loading,
  onCancel,
  onReasonChange,
  onSubmit,
  order,
  reason,
}: {
  loading: boolean;
  onCancel(): void;
  onReasonChange(reason: string): void;
  onSubmit(): void;
  order: Order;
  reason: string;
}) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit();
  }

  return (
    <section
      aria-labelledby="cancel-order-title"
      aria-modal="true"
      className="confirm-backdrop"
      role="dialog"
    >
      <form className="confirm-dialog" onSubmit={submit}>
        <p className="eyebrow">Cancel order</p>
        <h3 id="cancel-order-title">{order.reference}</h3>
        <p>
          This will cancel the customer order if the backend confirms it is
          still cancellable. It does not process a payment refund.
        </p>
        <label>
          <span>Reason optional</span>
          <textarea
            maxLength={500}
            onChange={(event) => onReasonChange(event.target.value)}
            rows={4}
            value={reason}
          />
        </label>
        <span className="field-help">
          {reason.trim().length}/500 characters
        </span>
        <div className="confirm-actions">
          <button
            className="button button--quiet"
            disabled={loading}
            onClick={onCancel}
            type="button"
          >
            Keep order
          </button>
          <button
            className="button button--danger"
            disabled={loading}
            type="submit"
          >
            {loading ? "Cancelling order" : "Cancel order"}
          </button>
        </div>
      </form>
    </section>
  );
}
