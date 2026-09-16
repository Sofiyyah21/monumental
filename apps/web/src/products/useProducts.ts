import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ApiError,
  apiClient as defaultApiClient,
  type ApiClient,
} from "../api/client";
import type {
  Product,
  ProductCategory,
  ProductFilters,
  ProductInput,
  ProductUnit,
  ProductUpdateInput,
} from "../api/types";
import { productErrorMessage } from "./product-utils";

export type ProductStatusFilter = "active" | "inactive";

export type ProductListFilters = {
  search: string;
  category: ProductCategory | "";
  unit: ProductUnit | "";
  status: ProductStatusFilter;
};

export type ProductMutationStatus = {
  loading: boolean;
  message: string | null;
  error: string | null;
};

const defaultFilters: ProductListFilters = {
  search: "",
  category: "",
  unit: "",
  status: "active",
};

export function useProducts(client: ApiClient = defaultApiClient) {
  const [filters, setFilters] = useState<ProductListFilters>(defaultFilters);
  const debouncedSearch = useDebouncedValue(filters.search, 250);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mutation, setMutation] = useState<ProductMutationStatus>({
    loading: false,
    message: null,
    error: null,
  });

  const apiFilters = useMemo<ProductFilters>(
    () => ({
      search: debouncedSearch.trim() || undefined,
      category: filters.category || undefined,
      unit: filters.unit || undefined,
      active: filters.status === "active",
    }),
    [debouncedSearch, filters.category, filters.status, filters.unit],
  );

  const loadProducts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setProducts(await client.listProducts(apiFilters));
    } catch {
      setError("Products could not load. Check your connection and try again.");
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

  const mutateProduct = useCallback(
    async (message: string, action: () => Promise<void>) => {
      setMutation({ loading: true, message: null, error: null });
      try {
        await action();
        setMutation({ loading: false, message, error: null });
        return true;
      } catch (error) {
        setMutation({
          loading: false,
          message: null,
          error:
            error instanceof ApiError
              ? productErrorMessage(error)
              : "The product request could not be completed.",
        });
        return false;
      }
    },
    [],
  );

  const createProduct = useCallback(
    async (input: ProductInput) => {
      return mutateProduct("Product created.", async () => {
        await client.createProduct(input);
        await loadProducts();
      });
    },
    [client, loadProducts, mutateProduct],
  );

  const updateProduct = useCallback(
    async (id: string, input: ProductUpdateInput) => {
      return mutateProduct("Product updated.", async () => {
        await client.updateProduct(id, input);
        await loadProducts();
      });
    },
    [client, loadProducts, mutateProduct],
  );

  const deactivateProduct = useCallback(
    async (id: string) => {
      return mutateProduct("Product deactivated.", async () => {
        await client.deactivateProduct(id);
        await loadProducts();
      });
    },
    [client, loadProducts, mutateProduct],
  );

  return {
    products,
    filters,
    loading,
    error,
    mutation,
    setFilters,
    reload: loadProducts,
    createProduct,
    updateProduct,
    deactivateProduct,
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
