import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ApiError,
  apiClient as defaultApiClient,
  type ApiClient,
} from "../api/client";
import type {
  PaymentMethod,
  PaymentStatus,
  Product,
  ProductCategory,
  Sale,
} from "../api/types";
import {
  addProductToCart,
  getCartSubtotal,
  getCartTotal,
  removeCartLine,
  saleErrorMessage,
  toCreateSaleInput,
  updateCartQuantity,
  validateCartLine,
  type CartLine,
} from "./pos-utils";

export type PosProductFilters = {
  search: string;
  category: ProductCategory | "";
};

export type CheckoutFields = {
  discountAmount: string;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  paymentReference: string;
};

export type SaleMutationStatus = {
  loading: boolean;
  message: string | null;
  error: string | null;
};

const defaultFilters: PosProductFilters = {
  search: "",
  category: "",
};

const defaultCheckout: CheckoutFields = {
  discountAmount: "0",
  paymentMethod: "CASH",
  paymentStatus: "PAID",
  paymentReference: "",
};

export function usePos(client: ApiClient = defaultApiClient) {
  const [filters, setFilters] = useState(defaultFilters);
  const debouncedSearch = useDebouncedValue(filters.search, 200);
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [checkout, setCheckout] = useState<CheckoutFields>(defaultCheckout);
  const [completedSale, setCompletedSale] = useState<Sale | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [mutation, setMutation] = useState<SaleMutationStatus>({
    loading: false,
    message: null,
    error: null,
  });

  const productApiFilters = useMemo(
    () => ({
      search: debouncedSearch.trim() || undefined,
      category: filters.category || undefined,
      active: true,
    }),
    [debouncedSearch, filters.category],
  );

  const loadProducts = useCallback(async () => {
    setLoadingProducts(true);
    setLookupError(null);
    try {
      setProducts(await client.listProducts(productApiFilters));
    } catch {
      setLookupError(
        "Products could not load. Check your connection and try again.",
      );
    } finally {
      setLoadingProducts(false);
    }
  }, [client, productApiFilters]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadProducts();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadProducts]);

  const addToCart = useCallback((product: Product, quantity: number) => {
    const validationMessage = validateCartLine(product, quantity);
    if (validationMessage?.startsWith("Quantity is above")) {
      setFormError(validationMessage);
    } else if (validationMessage) {
      setFormError(validationMessage);
      return false;
    } else {
      setFormError(null);
    }

    setCompletedSale(null);
    setCart((currentCart) => addProductToCart(currentCart, product, quantity));
    return true;
  }, []);

  const updateQuantity = useCallback((productId: string, quantity: number) => {
    setCompletedSale(null);
    setCart((currentCart) =>
      updateCartQuantity(currentCart, productId, quantity),
    );
  }, []);

  const removeFromCart = useCallback((productId: string) => {
    setCompletedSale(null);
    setCart((currentCart) => removeCartLine(currentCart, productId));
  }, []);

  const submitSale = useCallback(async () => {
    setFormError(null);
    setMutation({ loading: true, message: null, error: null });

    const discountAmount =
      checkout.discountAmount.trim() === ""
        ? 0
        : Number(checkout.discountAmount);
    const saleInput = toCreateSaleInput({
      cart,
      discountAmount,
      paymentMethod: checkout.paymentMethod,
      paymentStatus: checkout.paymentStatus,
      paymentReference: checkout.paymentReference,
    });

    if (!saleInput.ok) {
      setMutation({ loading: false, message: null, error: null });
      setFormError(saleInput.message);
      return false;
    }

    try {
      const sale = await client.createSale(saleInput.value);
      setCompletedSale(sale);
      setCart([]);
      setCheckout(defaultCheckout);
      setMutation({
        loading: false,
        message: `Sale ${sale.reference} completed.`,
        error: null,
      });
      await loadProducts();
      return true;
    } catch (error) {
      setMutation({
        loading: false,
        message: null,
        error:
          error instanceof ApiError
            ? saleErrorMessage(error)
            : "The sale could not be completed.",
      });
      return false;
    }
  }, [cart, checkout, client, loadProducts]);

  const discountPreview =
    checkout.discountAmount.trim() === "" ? 0 : Number(checkout.discountAmount);

  return {
    cart,
    checkout,
    completedSale,
    filters,
    formError,
    loadingProducts,
    lookupError,
    mutation,
    products,
    subtotal: getCartSubtotal(cart),
    total: getCartTotal(
      cart,
      Number.isNaN(discountPreview) ? 0 : discountPreview,
    ),
    addToCart,
    removeFromCart,
    setCheckout,
    setFilters,
    submitSale,
    updateQuantity,
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
