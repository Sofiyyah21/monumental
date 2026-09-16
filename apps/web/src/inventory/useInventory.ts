import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ApiError,
  apiClient as defaultApiClient,
  type ApiClient,
} from "../api/client";
import type {
  InventoryItem,
  StockMovement,
  StockMovementFilters,
  StockMovementType,
} from "../api/types";
import type {
  InventoryOperation,
  InventoryOperationInput,
} from "./inventory-form";
import { inventoryErrorMessage } from "./inventory-utils";

export type InventoryStatusFilter = "all" | "low" | "out";

export type InventoryListFilters = {
  stockStatus: InventoryStatusFilter;
};

export type MovementListFilters = {
  productId: string;
  type: StockMovementType | "";
  from: string;
  to: string;
  limit: number;
};

export type InventoryMutationStatus = {
  loading: boolean;
  message: string | null;
  error: string | null;
};

const defaultInventoryFilters: InventoryListFilters = {
  stockStatus: "all",
};

const defaultMovementFilters: MovementListFilters = {
  productId: "",
  type: "",
  from: "",
  to: "",
  limit: 25,
};

export function useInventory(client: ApiClient = defaultApiClient) {
  const [filters, setFilters] = useState(defaultInventoryFilters);
  const [movementFilters, setMovementFilters] = useState(
    defaultMovementFilters,
  );
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [lowStock, setLowStock] = useState<InventoryItem[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<InventoryItem | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [movementsLoading, setMovementsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [movementError, setMovementError] = useState<string | null>(null);
  const [mutation, setMutation] = useState<InventoryMutationStatus>({
    loading: false,
    message: null,
    error: null,
  });

  const apiMovementFilters = useMemo<StockMovementFilters>(() => {
    return {
      productId: movementFilters.productId || undefined,
      type: movementFilters.type || undefined,
      from: movementFilters.from
        ? new Date(`${movementFilters.from}T00:00:00`).toISOString()
        : undefined,
      to: movementFilters.to
        ? new Date(`${movementFilters.to}T23:59:59.999`).toISOString()
        : undefined,
      limit: movementFilters.limit,
    };
  }, [movementFilters]);

  const loadInventory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [inventoryItems, lowStockItems] = await Promise.all([
        client.listInventory({ active: true }),
        client.listLowStockInventory(),
      ]);
      setInventory(inventoryItems);
      setLowStock(lowStockItems);
    } catch {
      setError(
        "Inventory could not load. Check your connection and try again.",
      );
    } finally {
      setLoading(false);
    }
  }, [client]);

  const loadMovements = useCallback(async () => {
    setMovementsLoading(true);
    setMovementError(null);
    try {
      setMovements(await client.listStockMovements(apiMovementFilters));
    } catch {
      setMovementError("Stock movement history could not load.");
    } finally {
      setMovementsLoading(false);
    }
  }, [apiMovementFilters, client]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadInventory();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadInventory]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadMovements();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadMovements]);

  const refreshAll = useCallback(async () => {
    await Promise.all([loadInventory(), loadMovements()]);
  }, [loadInventory, loadMovements]);

  const selectProduct = useCallback(
    async (productId: string) => {
      setSelectedProduct(null);
      try {
        setSelectedProduct(await client.getProductInventory(productId));
      } catch {
        setMutation({
          loading: false,
          message: null,
          error: "Product inventory details could not load.",
        });
      }
    },
    [client],
  );

  const submitOperation = useCallback(
    async (input: Exclude<InventoryOperationInput, { ok: false }>) => {
      setMutation({ loading: true, message: null, error: null });
      try {
        if (input.operation === "receive") {
          await client.receiveStock(input.value);
        } else if (input.operation === "adjust") {
          await client.adjustStock(input.value);
        } else if (input.operation === "return") {
          await client.returnStock(input.value);
        } else {
          await client.recordDamage(input.value);
        }
        await refreshAll();
        setMutation({
          loading: false,
          message: operationSuccessMessage(input.operation),
          error: null,
        });
        return true;
      } catch (error) {
        setMutation({
          loading: false,
          message: null,
          error:
            error instanceof ApiError
              ? inventoryErrorMessage(error)
              : "The inventory request could not be completed.",
        });
        return false;
      }
    },
    [client, refreshAll],
  );

  return {
    filters,
    inventory,
    loading,
    error,
    lowStock,
    movementError,
    movementFilters,
    movements,
    movementsLoading,
    mutation,
    selectedProduct,
    reload: refreshAll,
    selectProduct,
    setFilters,
    setMovementFilters,
    submitOperation,
  };
}

function operationSuccessMessage(operation: InventoryOperation) {
  if (operation === "receive") {
    return "Stock received.";
  }
  if (operation === "adjust") {
    return "Stock adjusted.";
  }
  if (operation === "return") {
    return "Stock return recorded.";
  }
  return "Damaged stock recorded.";
}
