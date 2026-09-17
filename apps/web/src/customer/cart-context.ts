import { createContext } from "react";
import type { CustomerCatalogProduct } from "../api/types";
import type { CartSummary, CustomerCartItem } from "./cart-utils";

export type CustomerCartContextValue = {
  items: CustomerCartItem[];
  summary: CartSummary;
  addProduct(product: CustomerCatalogProduct, quantity?: number): void;
  updateQuantity(productId: string, quantity: number): void;
  increaseQuantity(productId: string): void;
  decreaseQuantity(productId: string): void;
  removeItem(productId: string): void;
  clearCart(): void;
};

export const CustomerCartContext = createContext<
  CustomerCartContextValue | undefined
>(undefined);
