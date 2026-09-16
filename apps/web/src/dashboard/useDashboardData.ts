import { useCallback, useEffect, useState } from "react";
import {
  ApiError,
  apiClient as defaultApiClient,
  type ApiClient,
} from "../api/client";
import type {
  BestSellersReport,
  DashboardPeriod,
  LowStockReportItem,
  Sale,
  SalesSummaryReport,
} from "../api/types";
import { buildRangeFilter, isReportPeriod } from "./dashboard-utils";

export type CustomRange = {
  from: string;
  to: string;
};

export type DashboardData = {
  summary: SalesSummaryReport;
  bestSellers: BestSellersReport;
  lowStock: LowStockReportItem[];
  recentSales: Sale[];
};

export type DashboardState = {
  data: DashboardData | null;
  lowStock: LowStockReportItem[];
  loading: boolean;
  lowStockLoading: boolean;
  error: string | null;
  lowStockError: string | null;
};

export function useDashboardData(
  period: DashboardPeriod,
  customRange: CustomRange,
  client: ApiClient = defaultApiClient,
) {
  const [state, setState] = useState<DashboardState>({
    data: null,
    lowStock: [],
    loading: true,
    lowStockLoading: true,
    error: null,
    lowStockError: null,
  });

  const loadLowStock = useCallback(async () => {
    setState((current) => ({
      ...current,
      lowStockLoading: true,
      lowStockError: null,
    }));
    try {
      const lowStock = await client.getLowStock();
      setState((current) => ({
        ...current,
        lowStock,
        lowStockLoading: false,
        lowStockError: null,
        data: current.data ? { ...current.data, lowStock } : current.data,
      }));
    } catch {
      setState((current) => ({
        ...current,
        lowStockLoading: false,
        lowStockError: "Stock attention list could not load.",
      }));
    }
  }, [client]);

  const loadDashboard = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: null }));
    try {
      const summary = await client.getSalesSummary(
        period,
        isReportPeriod(period) ? {} : customRange,
      );
      const rangeFilter = buildRangeFilter(summary.range);
      const [bestSellers, recentSales] = await Promise.all([
        client.getBestSellers({ ...rangeFilter, limit: 5 }),
        client.getRecentSales({ ...rangeFilter, limit: 5 }),
      ]);

      setState((current) => ({
        ...current,
        data: {
          summary,
          bestSellers,
          recentSales,
          lowStock: current.lowStock,
        },
        loading: false,
        error: null,
      }));
    } catch (error) {
      setState((current) => ({
        ...current,
        loading: false,
        error: getDashboardErrorMessage(error),
      }));
    }
  }, [client, customRange, period]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadLowStock();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadLowStock]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadDashboard();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadDashboard]);

  return {
    ...state,
    reload: loadDashboard,
    reloadLowStock: loadLowStock,
  };
}

function getDashboardErrorMessage(error: unknown) {
  if (error instanceof ApiError && error.status === 403) {
    return "Your account does not have permission to view management reports.";
  }
  if (error instanceof ApiError && error.status === 401) {
    return "Your session has expired. Sign in again to continue.";
  }
  return "Reporting data could not load.";
}
