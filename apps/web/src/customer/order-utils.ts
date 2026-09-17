import type { ApiError } from "../api/client";
import type {
  CreateOrderInput,
  Order,
  OrderPaymentStatus,
  OrderStatus,
} from "../api/types";
import type { CustomerCartItem } from "./cart-utils";

export const orderStatusLabels: Record<OrderStatus, string> = {
  PENDING: "Pending",
  CONFIRMED: "Confirmed",
  CANCELLED: "Cancelled",
  FULFILLED: "Fulfilled",
};

export const orderPaymentStatusLabels: Record<OrderPaymentStatus, string> = {
  UNPAID: "Unpaid",
  PAID: "Paid",
  FAILED: "Failed",
};

export function buildCreateOrderInput(
  items: CustomerCartItem[],
): CreateOrderInput {
  return {
    items: items.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
    })),
  };
}

export function isOrderCancellable(order: Order) {
  return order.status === "PENDING" || order.status === "CONFIRMED";
}

export function getOrderQuantity(order: Order) {
  return (order.items ?? []).reduce(
    (total, item) => total + Number(item.quantity),
    0,
  );
}

export function getOrderItemCount(order: Order) {
  return order.items?.length ?? 0;
}

export function formatOrderDate(value: string) {
  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Lagos",
  }).format(new Date(value));
}

export function formatOrderQuantity(value: string | number) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) {
    return "0";
  }
  return Number.isInteger(numberValue)
    ? String(numberValue)
    : numberValue.toLocaleString("en-NG", {
        maximumFractionDigits: 3,
        minimumFractionDigits: 0,
      });
}

export function getOrderStatusClass(order: Pick<Order, "status">) {
  if (order.status === "CANCELLED") {
    return "status-badge--VOIDED";
  }
  if (order.status === "FULFILLED") {
    return "status-badge--IN_STOCK";
  }
  return "status-badge--LOW_STOCK";
}

export function orderDisplayError(error: Pick<ApiError, "status" | "code">) {
  if (error.status === 401) {
    return "Your session has expired. Sign in again to continue.";
  }
  if (error.status === 403) {
    return "Your account cannot access customer orders.";
  }
  if (error.status === 404) {
    return "We could not find that order or product.";
  }
  if (error.status === 409 || error.code === "PRODUCT_UNAVAILABLE") {
    return "One or more cart items are no longer available in the requested quantity. Please review your cart and try again.";
  }
  if (error.status === 400) {
    return "The order information was not accepted. Please review your cart and try again.";
  }
  return "Orders could not be loaded right now. Check your connection and try again.";
}

export function orderCancelDisplayError(
  error: Pick<ApiError, "status" | "code">,
) {
  if (error.status === 409) {
    return "This order can no longer be cancelled.";
  }
  if (error.status === 404) {
    return "We could not find that order.";
  }
  if (error.status === 401) {
    return "Your session has expired. Sign in again to continue.";
  }
  if (error.status === 403) {
    return "Your account cannot cancel this order.";
  }
  return "The order could not be cancelled. Please try again.";
}
