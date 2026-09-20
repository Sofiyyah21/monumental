import type { ApiError } from "../api/client";
import type {
  Order,
  OrderFilters,
  OrderPaymentStatus,
  OrderStatus,
  OrderUserSnapshot,
} from "../api/types";
import {
  formatOrderDate,
  formatOrderQuantity,
  getOrderItemCount,
  getOrderQuantity,
  orderPaymentStatusLabels,
  orderStatusLabels,
} from "../customer/order-utils";

export type ManagementOrderFilters = {
  status: OrderStatus | "";
  paymentStatus: OrderPaymentStatus | "";
  customerId: string;
  from: string;
  to: string;
};

export type ManagementOrderAction = "confirm" | "fulfill" | "cancel";

export const defaultManagementOrderFilters: ManagementOrderFilters = {
  status: "",
  paymentStatus: "",
  customerId: "",
  from: "",
  to: "",
};

export function toOrderFilters(filters: ManagementOrderFilters): OrderFilters {
  return {
    status: filters.status || undefined,
    paymentStatus: filters.paymentStatus || undefined,
    customerId: filters.customerId.trim() || undefined,
    from: filters.from || undefined,
    to: filters.to || undefined,
    limit: 50,
  };
}

export function isManagementOrderCancellable(order: Pick<Order, "status">) {
  return order.status === "PENDING" || order.status === "CONFIRMED";
}

export function getAvailableOrderActions(
  order: Pick<Order, "status">,
): ManagementOrderAction[] {
  if (order.status === "PENDING") {
    return ["confirm", "cancel"];
  }
  if (order.status === "CONFIRMED") {
    return ["fulfill", "cancel"];
  }
  return [];
}

export function actionLabel(action: ManagementOrderAction) {
  if (action === "confirm") return "Confirm Order";
  if (action === "fulfill") return "Mark as Fulfilled";
  return "Cancel Order";
}

export function actionDescription(action: ManagementOrderAction, order: Order) {
  if (action === "confirm") {
    return `Confirm ${order.reference}. Payment status will not change and inventory will not be reserved.`;
  }
  if (action === "fulfill") {
    return `Mark ${order.reference} as fulfilled. This does not decrement inventory, create stock movements, or create a Sale.`;
  }
  return `Cancel ${order.reference}. This does not restore inventory because customer orders do not reserve stock.`;
}

export function validateManagementCancelReason(reason: string) {
  const trimmed = reason.trim();
  if (!trimmed) {
    return "Enter a cancellation reason.";
  }
  if (trimmed.length > 500) {
    return "Cancellation reason must be 500 characters or fewer.";
  }
  return null;
}

export function managementOrderError(error: Pick<ApiError, "status" | "code">) {
  if (error.status === 401) {
    return "Your session has expired. Sign in again to continue.";
  }
  if (error.status === 403) {
    return "Your account cannot manage customer orders.";
  }
  if (error.status === 404) {
    return "That order could not be found.";
  }
  if (error.status === 409) {
    return "The order changed before this action completed. The latest order status has been loaded.";
  }
  if (error.status === 400) {
    return "The order request was not accepted. Review the filters or action and try again.";
  }
  return "Customer orders could not be loaded right now. Check your connection and try again.";
}

export function formatOrderCustomer(order: Order) {
  if (order.customer?.name) {
    return order.customer.email
      ? `${order.customer.name} (${order.customer.email})`
      : order.customer.name;
  }
  if (order.customer?.email) {
    return order.customer.email;
  }
  if (order.customerId) {
    return order.customerId;
  }
  return "Customer not exposed by API";
}

export function formatOrderActor(
  actor: OrderUserSnapshot | null | undefined,
  actorId: string | null | undefined,
) {
  if (actor?.name) {
    return actor.email ? `${actor.name} (${actor.email})` : actor.name;
  }
  if (actor?.email) {
    return actor.email;
  }
  return actorId ?? "Actor not exposed by API";
}

export function summarizeOrder(order: Order) {
  return {
    customer: formatOrderCustomer(order),
    itemCount: getOrderItemCount(order),
    quantity: formatOrderQuantity(getOrderQuantity(order)),
    paymentStatus: orderPaymentStatusLabels[order.paymentStatus],
    status: orderStatusLabels[order.status],
    createdAt: formatOrderDate(order.createdAt),
  };
}
