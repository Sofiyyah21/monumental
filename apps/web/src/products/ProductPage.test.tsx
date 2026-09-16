import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { Product } from "../api/types";
import { ProductManagementView } from "./ProductPage";
import {
  emptyProductForm,
  type ProductFormState,
  toProductInput,
} from "./product-form";
import {
  getUnitForCategory,
  isValidCategoryUnit,
  productErrorMessage,
} from "./product-utils";
import type { ProductListFilters, ProductMutationStatus } from "./useProducts";

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

const filters: ProductListFilters = {
  search: "",
  category: "",
  unit: "",
  status: "active",
};

const mutation: ProductMutationStatus = {
  loading: false,
  message: null,
  error: null,
};

function renderProducts(
  overrides: Partial<{
    canManage: boolean;
    confirmProduct: Product | null;
    error: string | null;
    filters: ProductListFilters;
    form: ProductFormState;
    formError: string | null;
    loading: boolean;
    mutation: ProductMutationStatus;
    products: Product[];
  }> = {},
) {
  return renderToStaticMarkup(
    <ProductManagementView
      canManage={overrides.canManage ?? true}
      confirmProduct={overrides.confirmProduct ?? null}
      error={overrides.error ?? null}
      filters={overrides.filters ?? filters}
      form={overrides.form ?? emptyProductForm}
      formError={overrides.formError ?? null}
      loading={overrides.loading ?? false}
      mutation={overrides.mutation ?? mutation}
      onCancelEdit={vi.fn()}
      onConfirmDeactivate={vi.fn()}
      onEditProduct={vi.fn()}
      onFilterChange={vi.fn()}
      onFormChange={vi.fn()}
      onRequestDeactivate={vi.fn()}
      onSubmitProduct={vi.fn()}
      products={overrides.products ?? products}
    />,
  );
}

describe("ProductManagementView", () => {
  it("renders the product list with catalog, price, stock, and status details", () => {
    const html = renderProducts();

    expect(html).toContain("Product management");
    expect(html).toContain("Indomie Noodles");
    expect(html).toContain("NOODLES-1");
    expect(html).toContain("Noodles");
    expect(html).toContain("Pack");
    expect(html).toContain("8 pack");
    expect(html).toContain("Active");
    expect(html).toContain("Vegetable Oil");
    expect(html).toContain("Inactive");
    expect(html).toContain("Edit");
    expect(html).toContain("Deactivate");
  });

  it("renders loading, empty, and API error states", () => {
    expect(renderProducts({ loading: true })).toContain("Loading products");
    expect(renderProducts({ products: [] })).toContain("No products found");
    expect(renderProducts({ error: "Products could not load." })).toContain(
      "Products unavailable",
    );
  });

  it("renders search, category, unit, and active/inactive filters", () => {
    const html = renderProducts({
      filters: {
        search: "oil",
        category: "VEGETABLE_OIL",
        unit: "LITER",
        status: "inactive",
      },
    });

    expect(html).toContain("Name or SKU");
    expect(html).toContain("All categories");
    expect(html).toContain("Vegetable oil");
    expect(html).toContain("All units");
    expect(html).toContain("Liter");
    expect(html).toContain("Inactive products");
  });

  it("shows management controls for admin and manager users", () => {
    const adminHtml = renderProducts({ canManage: true });
    const managerHtml = renderProducts({ canManage: true });

    expect(adminHtml).toContain("Add product");
    expect(adminHtml).toContain("Create product");
    expect(managerHtml).toContain("Edit");
    expect(managerHtml).toContain("Deactivate");
  });

  it("keeps staff product access read-only", () => {
    const html = renderProducts({ canManage: false });

    expect(html).toContain("Read-only product access");
    expect(html).not.toContain("Create product");
    expect(html).not.toContain("Deactivate product");
  });

  it("renders a confirmation step before deactivation", () => {
    const html = renderProducts({ confirmProduct: products[0] ?? null });

    expect(html).toContain("Deactivate product");
    expect(html).toContain(
      "without deleting historical sales or inventory records",
    );
  });

  it("surfaces validation and server errors in human language", () => {
    const html = renderProducts({
      formError: "Cost price must be zero or greater.",
      mutation: {
        loading: false,
        message: null,
        error:
          "A product with this SKU already exists. SKUs are saved in uppercase.",
      },
    });

    expect(html).toContain("Check product details");
    expect(html).toContain("Cost price must be zero or greater.");
    expect(html).toContain("Product action failed");
    expect(html).toContain("A product with this SKU already exists");
  });
});

describe("product form rules", () => {
  it("normalizes SKU values and accepts valid product category/unit pairs", () => {
    const input = toProductInput({
      ...emptyProductForm,
      name: "  Sugar  ",
      sku: " sugar-1 ",
      category: "SUGAR",
      unit: "CUP",
      costPrice: "150",
      sellingPrice: "200",
      reorderLevel: "3",
    });

    expect(input).toEqual({
      ok: true,
      value: {
        name: "Sugar",
        sku: "SUGAR-1",
        category: "SUGAR",
        unit: "CUP",
        costPrice: 150,
        sellingPrice: 200,
        reorderLevel: 3,
      },
    });
  });

  it("blocks invalid category/unit combinations and negative numbers before submit", () => {
    expect(getUnitForCategory("DRINKS")).toBe("PACK");
    expect(getUnitForCategory("NOODLES")).toBe("PACK");
    expect(getUnitForCategory("VEGETABLE_OIL")).toBe("LITER");
    expect(getUnitForCategory("SUGAR")).toBe("CUP");
    expect(isValidCategoryUnit("VEGETABLE_OIL", "CUP")).toBe(false);

    const invalidUnit = toProductInput({
      ...emptyProductForm,
      name: "Vegetable Oil",
      sku: "OIL-1",
      category: "VEGETABLE_OIL",
      unit: "CUP",
      costPrice: "10",
      sellingPrice: "12",
      reorderLevel: "2",
    });
    const invalidPrice = toProductInput({
      ...emptyProductForm,
      name: "Drinks",
      sku: "DRINK-1",
      costPrice: "-1",
      sellingPrice: "12",
      reorderLevel: "2",
    });

    expect(invalidUnit.ok).toBe(false);
    expect(invalidPrice.ok).toBe(false);
  });

  it("maps backend product API failures to useful UI copy", () => {
    expect(
      productErrorMessage({ code: "PRODUCT_SKU_EXISTS", status: 409 }),
    ).toBe(
      "A product with this SKU already exists. SKUs are saved in uppercase.",
    );
    expect(productErrorMessage({ status: 403 })).toBe(
      "Your account does not have permission to manage products.",
    );
    expect(productErrorMessage({ status: 401 })).toBe(
      "Your session has expired. Sign in again to continue.",
    );
  });
});
