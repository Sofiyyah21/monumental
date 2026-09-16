import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { InventoryItem, StockMovement } from "../api/types";
import { InventoryManagementView } from "./InventoryPage";
import {
  emptyInventoryForm,
  toInventoryOperationInput,
} from "./inventory-form";
import {
  getInventoryStockStatus,
  inventoryErrorMessage,
  summarizeInventory,
} from "./inventory-utils";
import type {
  InventoryListFilters,
  InventoryMutationStatus,
  MovementListFilters,
} from "./useInventory";

const inventory: InventoryItem[] = [
  {
    productId: "product_1",
    name: "Indomie Noodles",
    sku: "NOODLES-1",
    category: "NOODLES",
    unit: "PACK",
    currentStock: "8.000",
    reorderLevel: "5.000",
    lowStock: false,
    active: true,
  },
  {
    productId: "product_2",
    name: "Vegetable Oil",
    sku: "OIL-1",
    category: "VEGETABLE_OIL",
    unit: "LITER",
    currentStock: "2.000",
    reorderLevel: "4.000",
    lowStock: true,
    active: true,
  },
  {
    productId: "product_3",
    name: "Sugar",
    sku: "SUGAR-1",
    category: "SUGAR",
    unit: "CUP",
    currentStock: "0.000",
    reorderLevel: "3.000",
    lowStock: true,
    active: true,
  },
];

const movements: StockMovement[] = [
  {
    id: "movement_1",
    productId: "product_1",
    type: "RECEIVED",
    quantity: "5.000",
    previousStock: "3.000",
    newStock: "8.000",
    unitCost: "2500.00",
    reference: "INV-1",
    note: "Restock",
    saleId: null,
    createdById: "user_1",
    occurredAt: "2026-09-15T10:00:00.000Z",
    product: {
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
    createdBy: {
      id: "user_1",
      name: "Manager User",
      email: "manager@monumental.test",
      role: "MANAGER",
    },
  },
  {
    id: "movement_2",
    productId: "product_3",
    type: "DAMAGE",
    quantity: "1.000",
    previousStock: "1.000",
    newStock: "0.000",
    unitCost: null,
    reference: null,
    note: "Broken cup",
    saleId: null,
    createdById: "user_1",
    occurredAt: "2026-09-15T11:00:00.000Z",
  },
];

const filters: InventoryListFilters = { stockStatus: "all" };
const movementFilters: MovementListFilters = {
  productId: "",
  type: "",
  from: "",
  to: "",
  limit: 25,
};
const mutation: InventoryMutationStatus = {
  loading: false,
  message: null,
  error: null,
};

function renderInventory(
  overrides: Partial<{
    canManage: boolean;
    error: string | null;
    filters: InventoryListFilters;
    formError: string | null;
    inventory: InventoryItem[];
    loading: boolean;
    lowStock: InventoryItem[];
    movementError: string | null;
    movementFilters: MovementListFilters;
    movements: StockMovement[];
    movementsLoading: boolean;
    mutation: InventoryMutationStatus;
    selectedProduct: InventoryItem | null;
  }> = {},
) {
  return renderToStaticMarkup(
    <InventoryManagementView
      canManage={overrides.canManage ?? true}
      error={overrides.error ?? null}
      filters={overrides.filters ?? filters}
      form={emptyInventoryForm}
      formError={overrides.formError ?? null}
      inventory={overrides.inventory ?? inventory}
      loading={overrides.loading ?? false}
      lowStock={overrides.lowStock ?? inventory.slice(1)}
      movementError={overrides.movementError ?? null}
      movementFilters={overrides.movementFilters ?? movementFilters}
      movements={overrides.movements ?? movements}
      movementsLoading={overrides.movementsLoading ?? false}
      mutation={overrides.mutation ?? mutation}
      onFilterChange={vi.fn()}
      onFormChange={vi.fn()}
      onMovementFilterChange={vi.fn()}
      onProductDetails={vi.fn()}
      onSubmitOperation={vi.fn()}
      selectedProduct={overrides.selectedProduct ?? inventory[0] ?? null}
    />,
  );
}

describe("InventoryManagementView", () => {
  it("renders inventory overview, current stock, low stock, product details, and movements", () => {
    const html = renderInventory();

    expect(html).toContain("Stock workspace");
    expect(html).toContain("Total active products");
    expect(html).toContain("Indomie Noodles");
    expect(html).toContain("NOODLES-1");
    expect(html).toContain("8 pack");
    expect(html).toContain("In stock");
    expect(html).toContain("Vegetable Oil");
    expect(html).toContain("Low stock");
    expect(html).toContain("Sugar");
    expect(html).toContain("Out of stock");
    expect(html).toContain("Stock movement history");
    expect(html).toContain("Received");
    expect(html).toContain("Damage");
    expect(html).toContain("Manager User");
  });

  it("renders loading, empty, and API error states", () => {
    expect(renderInventory({ loading: true })).toContain("Loading inventory");
    expect(renderInventory({ inventory: [], lowStock: [] })).toContain(
      "No inventory found",
    );
    expect(renderInventory({ error: "Inventory failed." })).toContain(
      "Inventory unavailable",
    );
    expect(renderInventory({ movementsLoading: true })).toContain(
      "Loading movement history",
    );
    expect(renderInventory({ movementError: "Movements failed." })).toContain(
      "Movements unavailable",
    );
  });

  it("filters low-stock and out-of-stock views", () => {
    const lowHtml = renderInventory({ filters: { stockStatus: "low" } });
    const outHtml = renderInventory({ filters: { stockStatus: "out" } });

    expect(lowHtml).toContain(
      'class="button button--primary" type="button">Low stock',
    );
    expect(lowHtml).toContain("Vegetable Oil");
    expect(lowHtml).toContain("2 liter");
    expect(outHtml).toContain(
      'class="button button--primary" type="button">Out of stock',
    );
    expect(outHtml).toContain("Sugar");
    expect(outHtml).toContain("0 cup");
  });

  it("shows management controls for admins and managers, and read-only copy for staff", () => {
    const managerHtml = renderInventory({ canManage: true });
    const staffHtml = renderInventory({ canManage: false });

    expect(managerHtml).toContain("Record stock change");
    expect(managerHtml).toContain("Receive stock");
    expect(managerHtml).toContain("Adjust stock");
    expect(managerHtml).toContain("Record return");
    expect(managerHtml).toContain("Record damage");
    expect(staffHtml).toContain("Inventory is read-only for this role");
    expect(staffHtml).not.toContain("Record stock change");
  });

  it("renders movement filters and operation feedback", () => {
    const html = renderInventory({
      formError: "Quantity must be greater than zero.",
      mutation: {
        loading: false,
        message: "Stock received.",
        error: "This operation would make stock negative.",
      },
      movementFilters: {
        productId: "product_1",
        type: "RECEIVED",
        from: "2026-09-01",
        to: "2026-09-15",
        limit: 25,
      },
    });

    expect(html).toContain("Check inventory details");
    expect(html).toContain("Quantity must be greater than zero.");
    expect(html).toContain("Inventory saved");
    expect(html).toContain("Inventory action failed");
    expect(html).toContain("All types");
    expect(html).toContain("Received");
  });
});

describe("inventory rules and forms", () => {
  it("matches backend stock status boundaries", () => {
    expect(
      getInventoryStockStatus({ currentStock: "0.000", reorderLevel: "3.000" }),
    ).toBe("OUT_OF_STOCK");
    expect(
      getInventoryStockStatus({ currentStock: "2.000", reorderLevel: "3.000" }),
    ).toBe("LOW_STOCK");
    expect(
      getInventoryStockStatus({ currentStock: "4.000", reorderLevel: "3.000" }),
    ).toBe("IN_STOCK");
  });

  it("summarizes inventory without pretending mixed units are one quantity", () => {
    const summary = summarizeInventory(inventory);

    expect(summary.activeProductCount).toBe(3);
    expect(summary.lowStockCount).toBe(1);
    expect(summary.outOfStockCount).toBe(1);
    expect(summary.stockByUnit).toEqual(
      expect.arrayContaining([
        { unit: "PACK", quantity: 8 },
        { unit: "LITER", quantity: 2 },
        { unit: "CUP", quantity: 0 },
      ]),
    );
  });

  it("validates receive, adjustment, return, and damage inputs", () => {
    expect(
      toInventoryOperationInput({
        ...emptyInventoryForm,
        operation: "receive",
        productId: "product_1",
        unit: "PACK",
        quantity: "5",
      }),
    ).toEqual({
      ok: true,
      operation: "receive",
      value: {
        productId: "product_1",
        quantity: 5,
        unit: "PACK",
        unitCost: undefined,
        reference: undefined,
        note: undefined,
      },
    });

    expect(
      toInventoryOperationInput({
        ...emptyInventoryForm,
        operation: "adjust",
        productId: "product_1",
        unit: "PACK",
        quantityChange: "-1",
        reason: "Count correction",
      }),
    ).toEqual({
      ok: true,
      operation: "adjust",
      value: {
        productId: "product_1",
        quantityChange: -1,
        unit: "PACK",
        reason: "Count correction",
        reference: undefined,
      },
    });

    expect(
      toInventoryOperationInput({
        ...emptyInventoryForm,
        operation: "return",
        productId: "product_1",
        unit: "PACK",
        quantity: "1",
      }).ok,
    ).toBe(true);
    expect(
      toInventoryOperationInput({
        ...emptyInventoryForm,
        operation: "damage",
        productId: "product_1",
        unit: "PACK",
        quantity: "1",
        reason: "Damaged pack",
      }).ok,
    ).toBe(true);
  });

  it("blocks invalid inventory form values and maps API errors", () => {
    expect(
      toInventoryOperationInput({
        ...emptyInventoryForm,
        productId: "product_1",
        unit: "PACK",
        quantity: "0",
      }).ok,
    ).toBe(false);
    expect(
      toInventoryOperationInput({
        ...emptyInventoryForm,
        operation: "damage",
        productId: "product_1",
        unit: "PACK",
        quantity: "1",
      }).ok,
    ).toBe(false);
    expect(inventoryErrorMessage({ status: 409 })).toContain(
      "make stock negative",
    );
    expect(inventoryErrorMessage({ status: 403 })).toContain("permission");
  });
});
