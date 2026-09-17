import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { CustomerCatalogProduct } from "../api/types";
import { ShopCatalogView } from "./ShopPage";
import {
  defaultShopFilters,
  toShopProductFilters,
  type ShopProductFilters,
} from "./useShopProducts";

const products: CustomerCatalogProduct[] = [
  {
    id: "product_1",
    name: "Monumental Drinks Pack",
    sku: "DRINK-001",
    category: "DRINKS",
    unit: "PACK",
    sellingPrice: "3500.00",
    availability: "AVAILABLE",
  },
  {
    id: "product_2",
    name: "Vegetable Oil",
    sku: "OIL-001",
    category: "VEGETABLE_OIL",
    unit: "LITER",
    sellingPrice: "1200.00",
    availability: "OUT_OF_STOCK",
  },
];

function renderShop(
  overrides: Partial<{
    error: string | null;
    filters: ShopProductFilters;
    loading: boolean;
    products: CustomerCatalogProduct[];
  }> = {},
) {
  return renderToStaticMarkup(
    <ShopCatalogView
      error={overrides.error ?? null}
      filters={overrides.filters ?? defaultShopFilters}
      loading={overrides.loading ?? false}
      onFilterChange={vi.fn()}
      products={overrides.products ?? products}
    />,
  );
}

describe("ShopCatalogView", () => {
  it("renders active customer catalog products with customer-safe details", () => {
    const html = renderShop();

    expect(html).toContain("Monumental Details catalog");
    expect(html).toContain("Monumental Drinks Pack");
    expect(html).toContain("Code DRINK-001");
    expect(html).toContain("Drinks");
    expect(html).toContain("Pack");
    expect(html).toContain("₦3,500.00");
    expect(html).toContain("Available");
    expect(html).toContain("Vegetable Oil");
    expect(html).toContain("Out of stock");
  });

  it("does not expose internal management fields to customers", () => {
    const html = renderShop();

    expect(html).not.toContain("Cost Price");
    expect(html).not.toContain("costPrice");
    expect(html).not.toContain("Gross Profit");
    expect(html).not.toContain("COGS");
    expect(html).not.toContain("Reorder");
    expect(html).not.toContain("currentStock");
  });

  it("renders loading, empty, and API error states", () => {
    expect(renderShop({ loading: true })).toContain("Loading shop catalog");
    expect(renderShop({ products: [] })).toContain("No products found");
    expect(renderShop({ error: "The shop catalog could not load." })).toContain(
      "Catalog unavailable",
    );
  });

  it("renders product search, category, and unit filters", () => {
    const html = renderShop({
      filters: {
        search: "oil",
        category: "VEGETABLE_OIL",
        unit: "LITER",
      },
    });

    expect(html).toContain("Search products");
    expect(html).toContain("Search drinks, noodles, oil, or sugar");
    expect(html).toContain("All categories");
    expect(html).toContain("Vegetable oil");
    expect(html).toContain("All units");
    expect(html).toContain("Liter");
  });

  it("uses active-only backend filters for the customer catalog", () => {
    expect(
      toShopProductFilters({
        search: " sugar ",
        category: "SUGAR",
        unit: "CUP",
      }),
    ).toEqual({
      search: "sugar",
      category: "SUGAR",
      unit: "CUP",
      active: true,
    });
    expect(toShopProductFilters(defaultShopFilters)).toEqual({ active: true });
  });

  it("keeps the layout suitable for mobile catalog cards", () => {
    const html = renderShop();

    expect(html).toContain("shop-product-grid");
    expect(html).toContain("shop-product-card");
    expect(html).not.toContain("<table");
  });
});
