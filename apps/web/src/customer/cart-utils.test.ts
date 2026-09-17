import { describe, expect, it } from "vitest";
import type { CustomerCatalogProduct } from "../api/types";
import {
  addProductToCustomerCart,
  canAddProductToCart,
  removeCustomerCartItem,
  normalizeQuantity,
  shouldClearCustomerCart,
  summarizeCustomerCart,
  updateCustomerCartQuantity,
} from "./cart-utils";

const drink: CustomerCatalogProduct = {
  id: "product_1",
  name: "Monumental Drinks Pack",
  sku: "DRINK-001",
  category: "DRINKS",
  unit: "PACK",
  sellingPrice: "3500.00",
  availability: "AVAILABLE",
};

const oil: CustomerCatalogProduct = {
  id: "product_2",
  name: "Vegetable Oil",
  sku: "OIL-001",
  category: "VEGETABLE_OIL",
  unit: "LITER",
  sellingPrice: "1200.00",
  availability: "OUT_OF_STOCK",
};

describe("customer cart rules", () => {
  it("adds available products and blocks out-of-stock products", () => {
    expect(canAddProductToCart(drink)).toBe(true);
    expect(canAddProductToCart(oil)).toBe(false);

    const withDrink = addProductToCustomerCart([], drink);
    const withOil = addProductToCustomerCart(withDrink, oil);

    expect(withDrink).toHaveLength(1);
    expect(withDrink[0]).toMatchObject({
      productId: drink.id,
      name: drink.name,
      unit: "PACK",
      sellingPrice: "3500.00",
      quantity: 1,
    });
    expect(withOil).toEqual(withDrink);
  });

  it("merges duplicate products into one cart line", () => {
    const cart = addProductToCustomerCart(
      addProductToCustomerCart([], drink, 1),
      drink,
      2,
    );

    expect(cart).toHaveLength(1);
    expect(cart[0]?.quantity).toBe(3);
  });

  it("supports increase, decrease, direct update, zero-as-remove, and negative rejection", () => {
    const cart = addProductToCustomerCart([], drink, 2);
    const increased = updateCustomerCartQuantity(cart, drink.id, 4);
    const decreased = updateCustomerCartQuantity(increased, drink.id, 1);
    const removedByZero = updateCustomerCartQuantity(increased, drink.id, 0);
    const rejectedNegative = updateCustomerCartQuantity(
      increased,
      drink.id,
      -2,
    );
    const removed = removeCustomerCartItem(increased, drink.id);

    expect(increased[0]?.quantity).toBe(4);
    expect(decreased[0]?.quantity).toBe(1);
    expect(removedByZero).toEqual([]);
    expect(rejectedNegative).toEqual(increased);
    expect(removed).toEqual([]);
    expect(normalizeQuantity(2.9)).toBe(2);
    expect(normalizeQuantity(Number.NaN)).toBe(0);
  });

  it("calculates distinct lines, total quantity, and cart subtotal", () => {
    const cart = addProductToCustomerCart(
      addProductToCustomerCart([], drink, 2),
      {
        ...oil,
        availability: "AVAILABLE",
      },
      3,
    );

    expect(summarizeCustomerCart(cart)).toEqual({
      distinctProducts: 2,
      totalQuantity: 5,
      subtotal: 10600,
    });
  });

  it("keeps the cart free of internal fields and token data", () => {
    const cart = addProductToCustomerCart([], drink);

    expect(cart[0]).not.toHaveProperty("costPrice");
    expect(cart[0]).not.toHaveProperty("grossProfit");
    expect(cart[0]).not.toHaveProperty("reorderLevel");
    expect(cart[0]).not.toHaveProperty("currentStock");
    expect(cart[0]).not.toHaveProperty("accessToken");
    expect(cart[0]).not.toHaveProperty("refreshToken");
  });

  it("clears cart state outside an authenticated customer session", () => {
    expect(
      shouldClearCustomerCart({
        status: "authenticated",
        role: "CUSTOMER",
      }),
    ).toBe(false);
    expect(
      shouldClearCustomerCart({
        status: "unauthenticated",
        role: null,
      }),
    ).toBe(true);
    expect(
      shouldClearCustomerCart({
        status: "loading",
        role: "CUSTOMER",
      }),
    ).toBe(true);
    expect(
      shouldClearCustomerCart({
        status: "authenticated",
        role: "STAFF",
      }),
    ).toBe(true);
  });
});
