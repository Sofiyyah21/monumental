import { useCallback, useEffect, useState } from "react";
import {
  ApiError,
  apiClient as defaultApiClient,
  type ApiClient,
} from "../api/client";
import type { Order } from "../api/types";
import { orderDisplayError } from "./order-utils";

export function useCustomerOrders(client: ApiClient = defaultApiClient) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setOrders(await client.listOrders());
    } catch (error) {
      setError(
        error instanceof ApiError
          ? orderDisplayError(error)
          : "Orders could not be loaded right now.",
      );
    } finally {
      setLoading(false);
    }
  }, [client]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadOrders();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadOrders]);

  return { error, loading, orders, reload: loadOrders };
}

export function useCustomerOrderDetail(
  orderId: string | null,
  client: ApiClient = defaultApiClient,
) {
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(Boolean(orderId));
  const [error, setError] = useState<string | null>(null);
  const missingOrderId = !orderId;

  const loadOrder = useCallback(async () => {
    if (!orderId) return;

    setLoading(true);
    setError(null);
    try {
      setOrder(await client.getOrder(orderId));
    } catch (error) {
      setError(
        error instanceof ApiError
          ? orderDisplayError(error)
          : "Order detail could not be loaded right now.",
      );
    } finally {
      setLoading(false);
    }
  }, [client, orderId]);

  useEffect(() => {
    if (!orderId) return;

    const timeoutId = window.setTimeout(() => {
      void loadOrder();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadOrder, orderId]);

  return {
    error: missingOrderId ? "Order not found." : error,
    loading: missingOrderId ? false : loading,
    order: missingOrderId ? null : order,
    reload: loadOrder,
    setOrder,
  };
}
