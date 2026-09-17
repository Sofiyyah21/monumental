import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { CustomerCatalogProduct } from "../api/types";
import { useAuth } from "../auth/useAuth";
import {
  addProductToCustomerCart,
  removeCustomerCartItem,
  shouldClearCustomerCart,
  summarizeCustomerCart,
  updateCustomerCartQuantity,
  type CustomerCartItem,
} from "./cart-utils";
import {
  CustomerCartContext,
  type CustomerCartContextValue,
} from "./cart-context";

export function CustomerCartProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const [items, setItems] = useState<CustomerCartItem[]>([]);

  useEffect(() => {
    if (
      shouldClearCustomerCart({ status: auth.status, role: auth.user?.role })
    ) {
      const timeoutId = window.setTimeout(() => setItems([]), 0);
      return () => window.clearTimeout(timeoutId);
    }
    return undefined;
  }, [auth.status, auth.user?.id, auth.user?.role]);

  const addProduct = useCallback(
    (product: CustomerCatalogProduct, quantity = 1) => {
      setItems((currentItems) =>
        addProductToCustomerCart(currentItems, product, quantity),
      );
    },
    [],
  );

  const updateQuantity = useCallback((productId: string, quantity: number) => {
    setItems((currentItems) =>
      updateCustomerCartQuantity(currentItems, productId, quantity),
    );
  }, []);

  const increaseQuantity = useCallback((productId: string) => {
    setItems((currentItems) => {
      const line = currentItems.find((item) => item.productId === productId);
      if (!line) {
        return currentItems;
      }
      return updateCustomerCartQuantity(
        currentItems,
        productId,
        line.quantity + 1,
      );
    });
  }, []);

  const decreaseQuantity = useCallback((productId: string) => {
    setItems((currentItems) => {
      const line = currentItems.find((item) => item.productId === productId);
      if (!line) {
        return currentItems;
      }
      return updateCustomerCartQuantity(
        currentItems,
        productId,
        line.quantity - 1,
      );
    });
  }, []);

  const removeItem = useCallback((productId: string) => {
    setItems((currentItems) => removeCustomerCartItem(currentItems, productId));
  }, []);

  const clearCart = useCallback(() => setItems([]), []);

  const value = useMemo<CustomerCartContextValue>(
    () => ({
      items,
      summary: summarizeCustomerCart(items),
      addProduct,
      updateQuantity,
      increaseQuantity,
      decreaseQuantity,
      removeItem,
      clearCart,
    }),
    [
      addProduct,
      clearCart,
      decreaseQuantity,
      increaseQuantity,
      items,
      removeItem,
      updateQuantity,
    ],
  );

  return (
    <CustomerCartContext.Provider value={value}>
      {children}
    </CustomerCartContext.Provider>
  );
}
