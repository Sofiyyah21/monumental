import { useCallback, useEffect, useMemo, useState } from "react";
import { apiClient as defaultApiClient, type ApiClient } from "../api/client";
import type {
  CustomerCatalogProduct,
  ProductCategory,
  ProductFilters,
  ProductUnit,
} from "../api/types";

export type ShopProductFilters = {
  search: string;
  category: ProductCategory | "";
  unit: ProductUnit | "";
};

export const defaultShopFilters: ShopProductFilters = {
  search: "",
  category: "",
  unit: "",
};

export function toShopProductFilters(
  filters: ShopProductFilters,
): ProductFilters {
  return {
    search: filters.search.trim() || undefined,
    category: filters.category || undefined,
    unit: filters.unit || undefined,
    active: true,
  };
}

export function useShopProducts(client: ApiClient = defaultApiClient) {
  const [filters, setFilters] =
    useState<ShopProductFilters>(defaultShopFilters);
  const debouncedSearch = useDebouncedValue(filters.search, 250);
  const [products, setProducts] = useState<CustomerCatalogProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const apiFilters = useMemo(
    () =>
      toShopProductFilters({
        search: debouncedSearch,
        category: filters.category,
        unit: filters.unit,
      }),
    [debouncedSearch, filters.category, filters.unit],
  );

  const loadProducts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setProducts(await client.listCustomerCatalogProducts(apiFilters));
    } catch {
      setError(
        "The shop catalog could not load. Check your connection and try again.",
      );
    } finally {
      setLoading(false);
    }
  }, [apiFilters, client]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadProducts();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadProducts]);

  return {
    products,
    filters,
    loading,
    error,
    setFilters,
    reload: loadProducts,
  };
}

function useDebouncedValue<T>(value: T, delayMs: number) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedValue(value);
    }, delayMs);

    return () => window.clearTimeout(timeoutId);
  }, [delayMs, value]);

  return debouncedValue;
}
