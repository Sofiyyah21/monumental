import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { Product, Sale } from "../api/types";
import { PosView } from "./SalesPage";
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
import type {
  CheckoutFields,
  PosProductFilters,
  SaleMutationStatus,
} from "./usePos";

const products: Product[] = [
  {
    id: "product_1",
    name: "Indomie Noodles",
    sku: "NOODLES-1",
    category: "NOODLES",
    unit: "PACK",
    costPrice: "2500.00",
    sellingPrice: "3000.00",
    currentStock: "8.000",
    reorderLevel: "5.000",
    active: true,
    createdAt: "2026-09-15T09:00:00.000Z",
    updatedAt: "2026-09-15T09:00:00.000Z",
  },
  {
    id: "product_2",
    name: "Vegetable Oil",
    sku: "OIL-1",
    category: "VEGETABLE_OIL",
    unit: "LITER",
    costPrice: "800.00",
    sellingPrice: "1000.00",
    currentStock: "0.000",
    reorderLevel: "2.000",
    active: false,
    createdAt: "2026-09-15T09:00:00.000Z",
    updatedAt: "2026-09-15T09:00:00.000Z",
  },
];

const checkout: CheckoutFields = {
  discountAmount: "500",
  paymentMethod: "CASH",
  paymentStatus: "PAID",
  paymentReference: "",
};

const filters: PosProductFilters = {
  search: "",
  category: "",
};

const mutation: SaleMutationStatus = {
  loading: false,
  message: null,
  error: null,
};

const completedSale: Sale = {
  id: "sale_1",
  reference: "MD-20260915-00001",
  sellerId: "user_1",
  customerId: null,
  status: "COMPLETED",
  paymentMethod: "CASH",
  paymentStatus: "PAID",
  paymentReference: null,
  subtotal: "6000.00",
  discountAmount: "500.00",
  totalAmount: "5500.00",
  totalCost: "5000.00",
  grossProfit: "500.00",
  soldAt: "2026-09-15T10:00:00.000Z",
  items: [
    {
      id: "item_1",
      productId: "product_1",
      productName: "Indomie Noodles",
      productUnit: "PACK",
      quantity: "2.000",
      unitPrice: "3000.00",
      lineTotal: "6000.00",
      grossProfit: "1000.00",
    },
  ],
};

function renderPos(
  overrides: Partial<{
    cart: CartLine[];
    checkout: CheckoutFields;
    completedSale: Sale | null;
    filters: PosProductFilters;
    formError: string | null;
    loadingProducts: boolean;
    lookupError: string | null;
    mutation: SaleMutationStatus;
    products: Product[];
    quantityDrafts: Record<string, string>;
    subtotal: number;
    total: number;
  }> = {},
) {
  const cart = overrides.cart ?? [{ product: products[0]!, quantity: 2 }];
  return renderToStaticMarkup(
    <PosView
      cart={cart}
      checkout={overrides.checkout ?? checkout}
      completedSale={overrides.completedSale ?? null}
      filters={overrides.filters ?? filters}
      formError={overrides.formError ?? null}
      loadingProducts={overrides.loadingProducts ?? false}
      lookupError={overrides.lookupError ?? null}
      mutation={overrides.mutation ?? mutation}
      onAddProduct={vi.fn()}
      onCheckoutChange={vi.fn()}
      onCompleteSale={vi.fn()}
      onFilterChange={vi.fn()}
      onOpenSale={vi.fn()}
      onQuantityDraftChange={vi.fn()}
      onRemoveFromCart={vi.fn()}
      onUpdateCartQuantity={vi.fn()}
      products={overrides.products ?? products}
      quantityDrafts={
        overrides.quantityDrafts ?? { product_1: "1", product_2: "1" }
      }
      subtotal={overrides.subtotal ?? getCartSubtotal(cart)}
      total={
        overrides.total ?? getCartTotal(cart, Number(checkout.discountAmount))
      }
    />,
  );
}

describe("PosView", () => {
  it("renders product lookup, stock, cart totals, discount, and payment controls", () => {
    const html = renderPos();

    expect(html).toContain("Point of sale");
    expect(html).toContain("Product lookup");
    expect(html).toContain("Indomie Noodles");
    expect(html).toContain("NOODLES-1");
    expect(html).toContain("Available: 8 pack");
    expect(html).toContain("Vegetable Oil");
    expect(html).toContain("Inactive");
    expect(html).toContain("Cart");
    expect(html).toContain("Subtotal");
    expect(html).toContain("Discount");
    expect(html).toContain("Total");
    expect(html).toContain("Cash");
    expect(html).toContain("Transfer");
    expect(html).toContain("Paid");
    expect(html).toContain("Pending");
    expect(html).toContain("Complete sale");
  });

  it("renders search/category filters and loading, empty, and error states", () => {
    expect(renderPos({ loadingProducts: true })).toContain("Loading products");
    expect(renderPos({ products: [] })).toContain("No active products found");
    expect(renderPos({ lookupError: "Product lookup failed." })).toContain(
      "Products unavailable",
    );
    expect(
      renderPos({ filters: { search: "noodles", category: "NOODLES" } }),
    ).toContain("All categories");
  });

  it("renders empty cart, validation errors, backend errors, and success reference", () => {
    expect(renderPos({ cart: [] })).toContain("Cart is empty");
    expect(
      renderPos({ formError: "Discount cannot exceed the sale subtotal." }),
    ).toContain("Check sale details");
    expect(
      renderPos({
        mutation: {
          loading: false,
          message: null,
          error: "Insufficient stock.",
        },
      }),
    ).toContain("Sale failed");
    expect(renderPos({ completedSale })).toContain("MD-20260915-00001");
    expect(renderPos({ completedSale })).toContain("View receipt");
    expect(renderPos({ completedSale })).toContain("Ready for next sale");
  });
});

describe("POS cart and checkout utilities", () => {
  it("adds products, updates duplicate lines, changes quantities, and removes lines", () => {
    const firstCart = addProductToCart([], products[0]!, 1);
    const duplicateCart = addProductToCart(firstCart, products[0]!, 2);
    const updatedCart = updateCartQuantity(duplicateCart, "product_1", 5);
    const removedCart = removeCartLine(updatedCart, "product_1");

    expect(firstCart).toHaveLength(1);
    expect(duplicateCart[0]?.quantity).toBe(3);
    expect(updatedCart[0]?.quantity).toBe(5);
    expect(removedCart).toHaveLength(0);
  });

  it("calculates subtotal, discount preview, and validates checkout payload", () => {
    const cart = [{ product: products[0]!, quantity: 2 }];

    expect(getCartSubtotal(cart)).toBe(6000);
    expect(getCartTotal(cart, 500)).toBe(5500);
    expect(
      toCreateSaleInput({
        cart,
        discountAmount: 500,
        paymentMethod: "CASH",
        paymentStatus: "PAID",
        paymentReference: "",
      }),
    ).toEqual({
      ok: true,
      value: {
        paymentMethod: "CASH",
        paymentStatus: "PAID",
        paymentReference: undefined,
        discountAmount: 500,
        items: [{ productId: "product_1", quantity: 2 }],
      },
    });
  });

  it("blocks empty carts, invalid quantities, over-discounts, and inactive products", () => {
    expect(
      toCreateSaleInput({
        cart: [],
        discountAmount: 0,
        paymentMethod: "CASH",
        paymentStatus: "PAID",
        paymentReference: "",
      }).ok,
    ).toBe(false);
    expect(validateCartLine(products[0]!, 0)).toContain("greater than zero");
    expect(validateCartLine(products[1]!, 1)).toContain("Inactive");
    expect(validateCartLine(products[0]!, 99)).toContain("above the stock");
    expect(
      toCreateSaleInput({
        cart: [{ product: products[0]!, quantity: 1 }],
        discountAmount: 99999,
        paymentMethod: "CASH",
        paymentStatus: "PAID",
        paymentReference: "",
      }).ok,
    ).toBe(false);
  });

  it("maps backend checkout failures into user-facing messages", () => {
    expect(
      saleErrorMessage({ code: "INSUFFICIENT_STOCK", status: 409 }),
    ).toContain("Insufficient stock");
    expect(
      saleErrorMessage({ code: "INVALID_DISCOUNT", status: 400 }),
    ).toContain("Discount");
    expect(saleErrorMessage({ status: 403 })).toContain("permission");
  });
});
