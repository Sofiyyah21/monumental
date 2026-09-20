import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { Order } from "../api/types";
import {
  ManagementOrderDetailView,
  ManagementOrdersView,
  OrderActionDialog,
} from "./ManagementOrdersPage";
import {
  defaultManagementOrderFilters,
  getAvailableOrderActions,
  managementOrderError,
  toOrderFilters,
  validateManagementCancelReason,
} from "./management-order-utils";

const pendingOrder: Order = {
  id: "order_1",
  reference: "MD-ORD-20260920-00001",
  status: "PENDING",
  paymentStatus: "UNPAID",
  subtotal: "9500.00",
  customerId: "customer_1",
  customer: {
    id: "customer_1",
    name: "Customer One",
    email: "customer@example.com",
    role: "CUSTOMER",
  },
  cancelledAt: null,
  cancelReason: null,
  createdAt: "2026-09-20T09:00:00.000Z",
  updatedAt: "2026-09-20T09:00:00.000Z",
  items: [
    {
      id: "item_1",
      productId: "product_1",
      productName: "Snapshot Noodles",
      productSku: "NOOD-001",
      productCategory: "NOODLES",
      productUnit: "PACK",
      quantity: "2.000",
      unitPrice: "3500.00",
      lineSubtotal: "7000.00",
      createdAt: "2026-09-20T09:00:00.000Z",
    },
    {
      id: "item_2",
      productId: "product_2",
      productName: "Sugar Cup",
      productSku: "SUG-001",
      productCategory: "SUGAR",
      productUnit: "CUP",
      quantity: "5.000",
      unitPrice: "500.00",
      lineSubtotal: "2500.00",
      createdAt: "2026-09-20T09:00:00.000Z",
    },
  ],
};

const fulfilledOrder: Order = {
  ...pendingOrder,
  status: "FULFILLED",
  paymentStatus: "PAID",
  confirmedAt: "2026-09-20T10:00:00.000Z",
  confirmedById: "manager_1",
  confirmedBy: {
    id: "manager_1",
    name: "Manager One",
    email: "manager@example.com",
    role: "MANAGER",
  },
  fulfilledAt: "2026-09-20T11:00:00.000Z",
  fulfilledById: "admin_1",
  fulfilledBy: {
    id: "admin_1",
    name: "Admin One",
    email: "admin@example.com",
    role: "ADMIN",
  },
};

describe("ManagementOrdersView", () => {
  it("renders loading, empty, and API error states", () => {
    expect(
      renderToStaticMarkup(
        <ManagementOrdersView
          error={null}
          filters={defaultManagementOrderFilters}
          loading
          onFilterChange={vi.fn()}
          onOpenOrder={vi.fn()}
          orders={[]}
        />,
      ),
    ).toContain("Loading customer orders");
    expect(
      renderToStaticMarkup(
        <ManagementOrdersView
          error={null}
          filters={defaultManagementOrderFilters}
          loading={false}
          onFilterChange={vi.fn()}
          onOpenOrder={vi.fn()}
          orders={[]}
        />,
      ),
    ).toContain("No matching orders");
    expect(
      renderToStaticMarkup(
        <ManagementOrdersView
          error="Orders failed."
          filters={defaultManagementOrderFilters}
          loading={false}
          onFilterChange={vi.fn()}
          onOpenOrder={vi.fn()}
          orders={[]}
        />,
      ),
    ).toContain("Orders unavailable");
  });

  it("renders operational order rows with safe customer and status information", () => {
    const html = renderToStaticMarkup(
      <ManagementOrdersView
        error={null}
        filters={defaultManagementOrderFilters}
        loading={false}
        onFilterChange={vi.fn()}
        onOpenOrder={vi.fn()}
        orders={[pendingOrder]}
      />,
    );

    expect(html).toContain("Customer order queue");
    expect(html).toContain("MD-ORD-20260920-00001");
    expect(html).toContain("Customer One");
    expect(html).toContain("customer@example.com");
    expect(html).toContain("Pending");
    expect(html).toContain("Unpaid");
    expect(html).toContain("2 lines");
    expect(html).toContain("7 total");
    expect(html).toContain("₦9,500.00");
    expect(html).not.toContain("Cost price");
    expect(html).not.toContain("Gross profit");
    expect(html).not.toContain("Current stock");
  });

  it("converts filters to the backend-supported query shape", () => {
    expect(
      toOrderFilters({
        status: "CONFIRMED",
        paymentStatus: "UNPAID",
        customerId: " customer_1 ",
        from: "2026-09-20",
        to: "2026-09-21",
      }),
    ).toEqual({
      status: "CONFIRMED",
      paymentStatus: "UNPAID",
      customerId: "customer_1",
      from: "2026-09-20",
      to: "2026-09-21",
      limit: 50,
    });
  });
});

describe("ManagementOrderDetailView", () => {
  it("renders detail, item snapshots, audit metadata, and hides internal financial fields", () => {
    const html = renderToStaticMarkup(
      <ManagementOrderDetailView
        error={null}
        loading={false}
        onBackToOrders={vi.fn()}
        order={fulfilledOrder}
      />,
    );

    expect(html).toContain("MD-ORD-20260920-00001");
    expect(html).toContain("Fulfilled");
    expect(html).toContain("Paid");
    expect(html).toContain("Customer One");
    expect(html).toContain("Confirmed by");
    expect(html).toContain("Manager One");
    expect(html).toContain("Fulfilled by");
    expect(html).toContain("Admin One");
    expect(html).toContain("Snapshot Noodles");
    expect(html).toContain("NOOD-001");
    expect(html).toContain("Pack");
    expect(html).toContain("₦3,500.00");
    expect(html).toContain("₦9,500.00");
    expect(html).not.toContain("Cost price");
    expect(html).not.toContain("COGS");
    expect(html).not.toContain("Gross profit");
    expect(html).not.toContain("Current stock");
  });

  it("shows cancellation reason and no lifecycle action for cancelled orders", () => {
    const html = renderToStaticMarkup(
      <ManagementOrderDetailView
        error={null}
        loading={false}
        onBackToOrders={vi.fn()}
        order={{
          ...pendingOrder,
          status: "CANCELLED",
          cancelledAt: "2026-09-20T12:00:00.000Z",
          cancelledById: "manager_1",
          cancelReason: "Customer requested cancellation",
        }}
      />,
    );

    expect(html).toContain("Cancelled");
    expect(html).toContain("Cancellation reason");
    expect(html).toContain("Customer requested cancellation");
    expect(html).not.toContain("Confirm Order</button>");
    expect(html).not.toContain("Mark as Fulfilled</button>");
  });

  it("shows only valid lifecycle actions for each state", () => {
    expect(getAvailableOrderActions({ status: "PENDING" })).toEqual([
      "confirm",
      "cancel",
    ]);
    expect(getAvailableOrderActions({ status: "CONFIRMED" })).toEqual([
      "fulfill",
      "cancel",
    ]);
    expect(getAvailableOrderActions({ status: "FULFILLED" })).toEqual([]);
    expect(getAvailableOrderActions({ status: "CANCELLED" })).toEqual([]);
  });

  it("renders confirmation, fulfillment, and cancellation dialogs", () => {
    const confirmHtml = renderToStaticMarkup(
      <OrderActionDialog
        action="confirm"
        cancelReason=""
        loading
        onCancel={vi.fn()}
        onCancelReasonChange={vi.fn()}
        onSubmit={vi.fn()}
        order={pendingOrder}
      />,
    );
    const fulfillHtml = renderToStaticMarkup(
      <OrderActionDialog
        action="fulfill"
        cancelReason=""
        loading={false}
        onCancel={vi.fn()}
        onCancelReasonChange={vi.fn()}
        onSubmit={vi.fn()}
        order={{ ...pendingOrder, status: "CONFIRMED" }}
      />,
    );
    const cancelHtml = renderToStaticMarkup(
      <OrderActionDialog
        action="cancel"
        cancelReason=""
        formError="Enter a cancellation reason."
        loading={false}
        onCancel={vi.fn()}
        onCancelReasonChange={vi.fn()}
        onSubmit={vi.fn()}
        order={pendingOrder}
      />,
    );

    expect(confirmHtml).toContain("Confirm Order");
    expect(confirmHtml).toContain("disabled");
    expect(fulfillHtml).toContain("does not decrement inventory");
    expect(cancelHtml).toContain("Cancellation reason");
    expect(cancelHtml).toContain("Enter a cancellation reason.");
  });

  it("validates cancellation reasons and maps conflict errors safely", () => {
    expect(validateManagementCancelReason("   ")).toBe(
      "Enter a cancellation reason.",
    );
    expect(validateManagementCancelReason("x".repeat(501))).toBe(
      "Cancellation reason must be 500 characters or fewer.",
    );
    expect(validateManagementCancelReason("Valid reason")).toBeNull();
    expect(
      managementOrderError({ status: 409, code: "ORDER_STATE" }),
    ).toContain("latest order status");
  });
});
