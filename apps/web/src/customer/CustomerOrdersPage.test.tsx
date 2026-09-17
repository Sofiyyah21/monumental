import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { Order } from "../api/types";
import {
  CancelOrderDialog,
  CustomerOrderDetailView,
  CustomerOrdersView,
} from "./CustomerOrdersPage";
import {
  isOrderCancellable,
  orderCancelDisplayError,
  orderDisplayError,
} from "./order-utils";

const order: Order = {
  id: "order_1",
  reference: "MD-ORD-20260917-00001",
  status: "PENDING",
  paymentStatus: "UNPAID",
  subtotal: "7250.00",
  cancelledAt: null,
  cancelReason: null,
  createdAt: "2026-09-17T10:00:00.000Z",
  updatedAt: "2026-09-17T10:00:00.000Z",
  items: [
    {
      id: "item_1",
      productId: "product_1",
      productName: "Historical Drinks Pack",
      productSku: "DRINK-001",
      productCategory: "DRINKS",
      productUnit: "PACK",
      quantity: "2.000",
      unitPrice: "3500.00",
      lineSubtotal: "7000.00",
      createdAt: "2026-09-17T10:00:00.000Z",
    },
    {
      id: "item_2",
      productId: "product_2",
      productName: "Sugar Cup",
      productSku: "SUGAR-001",
      productCategory: "SUGAR",
      productUnit: "CUP",
      quantity: "1.000",
      unitPrice: "250.00",
      lineSubtotal: "250.00",
      createdAt: "2026-09-17T10:00:00.000Z",
    },
  ],
};

describe("CustomerOrdersView", () => {
  it("renders loading, empty, and API error states", () => {
    expect(
      renderToStaticMarkup(
        <CustomerOrdersView
          error={null}
          loading
          onOpenOrder={vi.fn()}
          orders={[]}
        />,
      ),
    ).toContain("Loading your orders");
    expect(
      renderToStaticMarkup(
        <CustomerOrdersView
          error={null}
          loading={false}
          onOpenOrder={vi.fn()}
          orders={[]}
        />,
      ),
    ).toContain("No orders yet");
    expect(
      renderToStaticMarkup(
        <CustomerOrdersView
          error="Orders could not be loaded."
          loading={false}
          onOpenOrder={vi.fn()}
          orders={[]}
        />,
      ),
    ).toContain("Orders unavailable");
  });

  it("renders customer order summaries and links", () => {
    const html = renderToStaticMarkup(
      <CustomerOrdersView
        error={null}
        loading={false}
        onOpenOrder={vi.fn()}
        orders={[order]}
      />,
    );

    expect(html).toContain("Customer order history");
    expect(html).toContain("MD-ORD-20260917-00001");
    expect(html).toContain("Pending");
    expect(html).toContain("Unpaid");
    expect(html).toContain("₦7,250.00");
    expect(html).toContain("2 lines");
    expect(html).toContain("3 total");
    expect(html).toContain("View MD-ORD-20260917-00001");
  });
});

describe("CustomerOrderDetailView", () => {
  it("renders backend order data, items, historical prices, subtotal, and statuses", () => {
    const html = renderToStaticMarkup(
      <CustomerOrderDetailView
        error={null}
        loading={false}
        onBackToOrders={vi.fn()}
        onContinueShopping={vi.fn()}
        order={order}
      />,
    );

    expect(html).toContain("MD-ORD-20260917-00001");
    expect(html).toContain("Pending");
    expect(html).toContain("Unpaid");
    expect(html).toContain("Historical Drinks Pack");
    expect(html).toContain("Code DRINK-001");
    expect(html).toContain("pack");
    expect(html).toContain("2");
    expect(html).toContain("₦3,500.00");
    expect(html).toContain("₦7,000.00");
    expect(html).toContain("Order subtotal");
    expect(html).toContain("₦7,250.00");
    expect(html).not.toContain("Cost price");
    expect(html).not.toContain("Gross profit");
    expect(html).not.toContain("Current stock");
    expect(html).not.toContain("Reorder level");
  });

  it("renders loading and missing-order errors", () => {
    expect(
      renderToStaticMarkup(
        <CustomerOrderDetailView
          error={null}
          loading
          onBackToOrders={vi.fn()}
          onContinueShopping={vi.fn()}
          order={null}
        />,
      ),
    ).toContain("Loading order detail");
    expect(
      renderToStaticMarkup(
        <CustomerOrderDetailView
          error="Order not found."
          loading={false}
          onBackToOrders={vi.fn()}
          onContinueShopping={vi.fn()}
          order={null}
        />,
      ),
    ).toContain("Order detail unavailable");
  });

  it("shows cancellation only for cancellable orders and hides it after cancellation", () => {
    const pendingHtml = renderToStaticMarkup(
      <CustomerOrderDetailView
        error={null}
        loading={false}
        onBackToOrders={vi.fn()}
        onContinueShopping={vi.fn()}
        order={order}
      />,
    );
    const cancelledHtml = renderToStaticMarkup(
      <CustomerOrderDetailView
        error={null}
        loading={false}
        onBackToOrders={vi.fn()}
        onContinueShopping={vi.fn()}
        order={{
          ...order,
          status: "CANCELLED",
          cancelledAt: "2026-09-17T11:00:00.000Z",
          cancelReason: "Changed plans",
        }}
      />,
    );

    expect(isOrderCancellable(order)).toBe(true);
    expect(pendingHtml).toContain("Cancel order");
    expect(cancelledHtml).not.toContain("Cancel order</button>");
    expect(cancelledHtml).toContain("Cancellation recorded");
    expect(cancelledHtml).toContain("Changed plans");
  });

  it("renders confirmation and duplicate-cancellation loading state", () => {
    const html = renderToStaticMarkup(
      <CancelOrderDialog
        loading
        onCancel={vi.fn()}
        onReasonChange={vi.fn()}
        onSubmit={vi.fn()}
        order={order}
        reason="Changed plans"
      />,
    );

    expect(html).toContain("This will cancel the customer order");
    expect(html).toContain("does not process a payment refund");
    expect(html).toContain("Cancelling order");
    expect(html).toContain("disabled");
  });

  it("maps customer-safe order errors", () => {
    expect(
      orderDisplayError({ status: 409, code: "PRODUCT_UNAVAILABLE" }),
    ).toContain("no longer available");
    expect(orderDisplayError({ status: 401, code: "AUTH" })).toContain(
      "session",
    );
    expect(
      orderCancelDisplayError({ status: 409, code: "ORDER_STATE" }),
    ).toContain("no longer be cancelled");
  });
});
