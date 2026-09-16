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

  useEffect(() => {
    if (!saleId) return;

    let active = true;
    const timeoutId = window.setTimeout(() => {
      setLoading(true);
      setError(null);

      void client
        .getSale(saleId)
        .then((result) => {
          if (active) {
            setSale(result);
          }
        })
        .catch((error: unknown) => {
          if (active) {
            setError(
              error instanceof ApiError
                ? saleDisplayError(error)
                : "Sale detail could not load.",
            );
          }
        })
        .finally(() => {
          if (active) {
            setLoading(false);
          }
        });
    }, 0);

    return () => {
      active = false;
      window.clearTimeout(timeoutId);
    };
  }, [client, saleId]);

  return {
    error: missingSaleId ? "Sale not found." : error,
    loading: missingSaleId ? false : loading,
    sale: missingSaleId ? null : sale,
  };
}
