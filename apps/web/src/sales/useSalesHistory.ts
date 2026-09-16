import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ApiError,
  apiClient as defaultApiClient,
  type ApiClient,
} from "../api/client";
import type { Sale } from "../api/types";
import {
  defaultSalesHistoryFilters,
  saleDisplayError,
  toSaleFilters,
  type SalesHistoryFilters,
} from "./sales-history-utils";

export function useSalesHistory(client: ApiClient = defaultApiClient) {
  const [filters, setFilters] = useState<SalesHistoryFilters>(
    defaultSalesHistoryFilters,
  );
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const apiFilters = useMemo(() => toSaleFilters(filters), [filters]);

  const loadSales = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setSales(await client.listSales(apiFilters));
    } catch (error) {
      setError(
        error instanceof ApiError
          ? saleDisplayError(error)
          : "Sales could not load.",
      );
    } finally {
      setLoading(false);
    }
  }, [apiFilters, client]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadSales();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadSales]);

  return {
    error,
    filters,
    loading,
    sales,
    reload: loadSales,
    setFilters,
  };
}

export function useSaleDetail(
  saleId: string | null,
  client: ApiClient = defaultApiClient,
) {
  const [sale, setSale] = useState<Sale | null>(null);
  const [loading, setLoading] = useState(Boolean(saleId));
  const [error, setError] = useState<string | null>(null);
  const missingSaleId = !saleId;

  const loadSale = useCallback(async () => {
    if (!saleId) return;

    setLoading(true);
    setError(null);
    try {
      setSale(await client.getSale(saleId));
    } catch (error) {
      setError(
        error instanceof ApiError
          ? saleDisplayError(error)
          : "Sale detail could not load.",
      );
    } finally {
      setLoading(false);
    }
  }, [client, saleId]);

  useEffect(() => {
    if (!saleId) return;

    let active = true;
    const timeoutId = window.setTimeout(() => {
      if (active) {
        void loadSale();
      }
    }, 0);

    return () => {
      active = false;
      window.clearTimeout(timeoutId);
    };
  }, [loadSale, saleId]);

  return {
    error: missingSaleId ? "Sale not found." : error,
    loading: missingSaleId ? false : loading,
    reload: loadSale,
    sale: missingSaleId ? null : sale,
    setSale,
  };
}
