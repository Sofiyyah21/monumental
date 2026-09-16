import type { Sale, SaleFilters } from "../api/types";
import { formatMoney, formatQuantity } from "../products/product-utils";
import { paymentStatusLabels } from "./pos-utils";

export type SalesHistoryFilters = {
  from: string;
  to: string;
  paymentStatus: SaleFilters["paymentStatus"] | "";
  limit: number;
};

export const defaultSalesHistoryFilters: SalesHistoryFilters = {
  from: "",
  to: "",
  paymentStatus: "",
  limit: 25,
};

export function toSaleFilters(filters: SalesHistoryFilters): SaleFilters {
  return {
    from: filters.from
      ? new Date(`${filters.from}T00:00:00`).toISOString()
      : undefined,
    to: filters.to
      ? new Date(`${filters.to}T23:59:59.999`).toISOString()
      : undefined,
    paymentStatus: filters.paymentStatus || undefined,
    limit: filters.limit,
  };
}

export function saleDisplayError(error: { status?: number; code?: string }) {
  if (error.code === "SALE_NOT_FOUND" || error.status === 404) {
    return "Sale not found.";
  }
  if (error.status === 401) {
    return "Your session has expired. Sign in again to continue.";
  }
  if (error.status === 403) {
    return "Your account does not have permission to view sales.";
  }
  if (error.status === 400) {
    return "Check the sales filters and try again.";
  }
  return "Sales information could not be loaded.";
}

export function getSaleItemCount(sale: Sale) {
  return sale.items?.length ?? 0;
}

export function getSaleCashier(sale: Sale) {
  return sale.seller?.name ?? sale.sellerId;
}

export function formatSaleDate(value: string) {
  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function formatSaleMoney(value: string | number | undefined) {
  return formatMoney(value ?? "0");
}

export function formatSaleQuantity(value: string | number) {
  return formatQuantity(value);
}

export function formatPaymentStatus(sale: Sale) {
  return paymentStatusLabels[sale.paymentStatus];
}
