import type {
  DashboardPeriod,
  ReportDateRange,
  ReportPeriod,
} from "../api/types";

export const periodOptions: Array<{ value: DashboardPeriod; label: string }> = [
  { value: "today", label: "Today" },
  { value: "week", label: "This Week" },
  { value: "month", label: "This Month" },
  { value: "year", label: "This Year" },
  { value: "custom", label: "Custom" },
];

export function isReportPeriod(
  period: DashboardPeriod,
): period is ReportPeriod {
  return period !== "custom";
}

export function formatMoney(value: string | number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 2,
  }).format(Number(value));
}

export function formatQuantity(value: string | number) {
  return new Intl.NumberFormat("en-NG", {
    maximumFractionDigits: 3,
  }).format(Number(value));
}

export function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function buildRangeFilter(range: ReportDateRange) {
  return {
    from: range.start,
    to: new Date(new Date(range.end).getTime() - 1).toISOString(),
  };
}
