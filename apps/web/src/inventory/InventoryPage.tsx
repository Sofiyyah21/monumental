import { useMemo, useState, type FormEvent } from "react";
import type {
  InventoryItem,
  ProductUnit,
  StockMovement,
  StockMovementType,
} from "../api/types";
import { hasPermission, permissions } from "../auth/permissions";
import { useAuth } from "../auth/useAuth";
import { Alert, EmptyState, LoadingState } from "../components/Feedback";
import {
  productCategoryLabels,
  productUnitLabels,
} from "../products/product-utils";
import {
  emptyInventoryForm,
  type InventoryOperation,
  type InventoryOperationForm,
  syncFormToProduct,
  toInventoryOperationInput,
} from "./inventory-form";
import {
  formatInventoryMoney,
  formatInventoryQuantity,
  getInventoryStockStatus,
  stockMovementTypeLabels,
  stockMovementTypes,
  stockStatusLabels,
  summarizeInventory,
} from "./inventory-utils";
import {
  type InventoryListFilters,
  type InventoryMutationStatus,
  type InventoryStatusFilter,
  type MovementListFilters,
  useInventory,
} from "./useInventory";

export function InventoryPage() {
  const auth = useAuth();
  const canManage = hasPermission(auth.user, permissions.MANAGE_INVENTORY);
  const {
    error,
    filters,
    inventory,
    loading,
    lowStock,
    movementError,
    movementFilters,
    movements,
    movementsLoading,
    mutation,
    selectedProduct,
    selectProduct,
    setFilters,
    setMovementFilters,
    submitOperation,
  } = useInventory();
  const [form, setForm] = useState<InventoryOperationForm>(emptyInventoryForm);
  const [formError, setFormError] = useState<string | null>(null);

  async function submitInventoryOperation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const input = toInventoryOperationInput(form);
    if (!input.ok) {
      setFormError(input.message);
      return;
    }

    const succeeded = await submitOperation(input);
    if (succeeded) {
      setForm({ ...emptyInventoryForm, operation: form.operation });
    }
  }

  return (
    <InventoryManagementView
      canManage={canManage}
      error={error}
      filters={filters}
      form={form}
      formError={formError}
      inventory={inventory}
      loading={loading}
      lowStock={lowStock}
      movementError={movementError}
      movementFilters={movementFilters}
      movements={movements}
      movementsLoading={movementsLoading}
      mutation={mutation}
      onFilterChange={setFilters}
      onFormChange={setForm}
      onMovementFilterChange={setMovementFilters}
      onProductDetails={(productId) => void selectProduct(productId)}
      onSubmitOperation={(event) => void submitInventoryOperation(event)}
      selectedProduct={selectedProduct}
    />
  );
}

export function InventoryManagementView({
  canManage,
  error,
  filters,
  form,
  formError,
  inventory,
  loading,
  lowStock,
  movementError,
  movementFilters,
  movements,
  movementsLoading,
  mutation,
  onFilterChange,
  onFormChange,
  onMovementFilterChange,
  onProductDetails,
  onSubmitOperation,
  selectedProduct,
}: {
  canManage: boolean;
  error: string | null;
  filters: InventoryListFilters;
  form: InventoryOperationForm;
  formError: string | null;
  inventory: InventoryItem[];
  loading: boolean;
  lowStock: InventoryItem[];
  movementError: string | null;
  movementFilters: MovementListFilters;
  movements: StockMovement[];
  movementsLoading: boolean;
  mutation: InventoryMutationStatus;
  onFilterChange(filters: InventoryListFilters): void;
  onFormChange(form: InventoryOperationForm): void;
  onMovementFilterChange(filters: MovementListFilters): void;
  onProductDetails(productId: string): void;
  onSubmitOperation(event: FormEvent<HTMLFormElement>): void;
  selectedProduct: InventoryItem | null;
}) {
  const visibleInventory = useMemo(
    () =>
      inventory.filter((item) => {
        const status = getInventoryStockStatus(item);
        if (filters.stockStatus === "low") {
          return status === "LOW_STOCK";
        }
        if (filters.stockStatus === "out") {
          return status === "OUT_OF_STOCK";
        }
        return true;
      }),
    [filters.stockStatus, inventory],
  );
  const summary = useMemo(() => summarizeInventory(inventory), [inventory]);

  return (
    <div className="inventory-grid">
      <section
        className="dashboard-hero inventory-hero"
        aria-labelledby="inventory-title"
      >
        <div>
          <p className="eyebrow">Inventory</p>
          <h2 id="inventory-title">Stock workspace</h2>
          <p>
            Track current balances, receive stock, record adjustments, and
            review stock movement history without editing product balances
            directly.
          </p>
        </div>
        <div className="product-note">
          <strong>Stock source of truth</strong>
          <span>
            Balances refresh from Product.currentStock after each operation.
          </span>
        </div>
      </section>

      <InventoryOverview summary={summary} />

      {mutation.message ? (
        <Alert title="Inventory saved" variant="info">
          {mutation.message}
        </Alert>
      ) : null}
      {mutation.error ? (
        <Alert title="Inventory action failed">{mutation.error}</Alert>
      ) : null}

      <div className="inventory-main">
        <section
          className="panel inventory-list-panel"
          aria-labelledby="stock-heading"
        >
          <div className="panel-heading">
            <p className="eyebrow">Current stock</p>
            <h3 id="stock-heading">Inventory list</h3>
          </div>
          <StockStatusFilter
            filters={filters}
            onFilterChange={onFilterChange}
          />
          {loading ? (
            <LoadingState message="Loading inventory" />
          ) : error ? (
            <Alert title="Inventory unavailable">{error}</Alert>
          ) : visibleInventory.length === 0 ? (
            <EmptyState title="No inventory found">
              <p>Try a different stock status filter.</p>
            </EmptyState>
          ) : (
            <InventoryTable
              items={visibleInventory}
              onProductDetails={onProductDetails}
            />
          )}
        </section>

        <section
          className="panel inventory-operation-panel"
          aria-labelledby="operation-heading"
        >
          <div className="panel-heading">
            <p className="eyebrow">Stock operation</p>
            <h3 id="operation-heading">
              {canManage ? "Record stock change" : "Read-only access"}
            </h3>
          </div>
          {canManage ? (
            <InventoryOperationFormView
              form={form}
              formError={formError}
              inventory={inventory}
              mutation={mutation}
              onFormChange={onFormChange}
              onSubmitOperation={onSubmitOperation}
            />
          ) : (
            <EmptyState title="Inventory is read-only for this role">
              <p>
                Staff can inspect stock and movement history, but cannot change
                balances.
              </p>
            </EmptyState>
          )}
        </section>
      </div>

      <div className="inventory-secondary">
        <LowStockPanel items={lowStock} loading={loading} />
        <ProductInventoryPanel product={selectedProduct} />
      </div>

      <MovementHistoryPanel
        error={movementError}
        filters={movementFilters}
        inventory={inventory}
        loading={movementsLoading}
        movements={movements}
        onFilterChange={onMovementFilterChange}
      />
    </div>
  );
}

function InventoryOverview({
  summary,
}: {
  summary: ReturnType<typeof summarizeInventory>;
}) {
  return (
    <section className="inventory-overview" aria-label="Inventory overview">
      <article>
        <span>Total active products</span>
        <strong>{summary.activeProductCount}</strong>
      </article>
      <article>
        <span>Low-stock products</span>
        <strong>{summary.lowStockCount}</strong>
      </article>
      <article>
        <span>Out-of-stock products</span>
        <strong>{summary.outOfStockCount}</strong>
      </article>
      <article>
        <span>Stock by unit</span>
        <strong>
          {summary.stockByUnit.length === 0
            ? "No stock"
            : summary.stockByUnit
                .map(({ quantity, unit }) =>
                  formatInventoryQuantity(quantity, unit),
                )
                .join(" / ")}
        </strong>
      </article>
    </section>
  );
}

function StockStatusFilter({
  filters,
  onFilterChange,
}: {
  filters: InventoryListFilters;
  onFilterChange(filters: InventoryListFilters): void;
}) {
  const options: Array<{ value: InventoryStatusFilter; label: string }> = [
    { value: "all", label: "All stock" },
    { value: "low", label: "Low stock" },
    { value: "out", label: "Out of stock" },
  ];
  return (
    <div
      className="inventory-filter-row"
      role="group"
      aria-label="Stock status filter"
    >
      {options.map((option) => (
        <button
          className={
            filters.stockStatus === option.value
              ? "button button--primary"
              : "button button--quiet"
          }
          key={option.value}
          onClick={() => onFilterChange({ stockStatus: option.value })}
          type="button"
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function InventoryTable({
  items,
  onProductDetails,
}: {
  items: InventoryItem[];
  onProductDetails(productId: string): void;
}) {
  return (
    <div className="inventory-table-wrap">
      <table className="inventory-table">
        <thead>
          <tr>
            <th scope="col">Product</th>
            <th scope="col">Category</th>
            <th scope="col">Unit</th>
            <th scope="col">Current stock</th>
            <th scope="col">Reorder level</th>
            <th scope="col">Status</th>
            <th scope="col">Details</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const status = getInventoryStockStatus(item);
            return (
              <tr key={item.productId}>
                <td data-label="Product">
                  <strong>{item.name}</strong>
                  <span>{item.sku}</span>
                </td>
                <td data-label="Category">
                  {productCategoryLabels[item.category]}
                </td>
                <td data-label="Unit">{productUnitLabels[item.unit]}</td>
                <td data-label="Current stock">
                  {formatInventoryQuantity(item.currentStock, item.unit)}
                </td>
                <td data-label="Reorder level">
                  {formatInventoryQuantity(item.reorderLevel, item.unit)}
                </td>
                <td data-label="Status">
                  <span className={`status-badge status-badge--${status}`}>
                    {stockStatusLabels[status]}
                  </span>
                </td>
                <td data-label="Details">
                  <button
                    className="button button--quiet"
                    onClick={() => onProductDetails(item.productId)}
                    type="button"
                  >
                    View stock
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function InventoryOperationFormView({
  form,
  formError,
  inventory,
  mutation,
  onFormChange,
  onSubmitOperation,
}: {
  form: InventoryOperationForm;
  formError: string | null;
  inventory: InventoryItem[];
  mutation: InventoryMutationStatus;
  onFormChange(form: InventoryOperationForm): void;
  onSubmitOperation(event: FormEvent<HTMLFormElement>): void;
}) {
  const selectedProduct = inventory.find(
    (item) => item.productId === form.productId,
  );
  const requiresReason =
    form.operation === "adjust" || form.operation === "damage";

  return (
    <form className="form-stack inventory-form" onSubmit={onSubmitOperation}>
      {formError ? (
        <Alert title="Check inventory details">{formError}</Alert>
      ) : null}
      <label>
        <span>Operation *</span>
        <select
          onChange={(event) =>
            onFormChange({
              ...form,
              operation: event.target.value as InventoryOperation,
            })
          }
          value={form.operation}
        >
          <option value="receive">Receive stock</option>
          <option value="adjust">Adjust stock</option>
          <option value="return">Record return</option>
          <option value="damage">Record damage</option>
        </select>
      </label>
      <label>
        <span>Product *</span>
        <select
          onChange={(event) => {
            const product = inventory.find(
              (item) => item.productId === event.target.value,
            );
            onFormChange(syncFormToProduct(form, product));
          }}
          required
          value={form.productId}
        >
          <option value="">Choose product</option>
          {inventory.map((item) => (
            <option key={item.productId} value={item.productId}>
              {item.name} ({item.sku})
            </option>
          ))}
        </select>
      </label>
      <div className="inventory-effect">
        {selectedProduct ? (
          <span>
            {selectedProduct.name} is tracked in{" "}
            <strong>{productUnitLabels[selectedProduct.unit]}</strong>. Current
            stock:{" "}
            <strong>
              {formatInventoryQuantity(
                selectedProduct.currentStock,
                selectedProduct.unit,
              )}
            </strong>
          </span>
        ) : (
          <span>Select a product to load its tracked unit.</span>
        )}
      </div>
      {form.operation === "adjust" ? (
        <label>
          <span>Quantity change *</span>
          <input
            onChange={(event) =>
              onFormChange({ ...form, quantityChange: event.target.value })
            }
            required
            step="0.001"
            type="number"
            value={form.quantityChange}
          />
          <small>
            Use positive values to add stock and negative values to reduce
            stock.
          </small>
        </label>
      ) : (
        <label>
          <span>Quantity *</span>
          <input
            min="0.001"
            onChange={(event) =>
              onFormChange({ ...form, quantity: event.target.value })
            }
            required
            step="0.001"
            type="number"
            value={form.quantity}
          />
        </label>
      )}
      {form.operation === "receive" ? (
        <label>
          <span>Unit cost</span>
          <input
            min="0"
            onChange={(event) =>
              onFormChange({ ...form, unitCost: event.target.value })
            }
            step="0.01"
            type="number"
            value={form.unitCost}
          />
          <small>
            Optional. If supplied, the backend updates product cost price.
          </small>
        </label>
      ) : null}
      {requiresReason ? (
        <label>
          <span>
            {form.operation === "damage"
              ? "Damage reason"
              : "Adjustment reason"}{" "}
            *
          </span>
          <textarea
            maxLength={500}
            onChange={(event) =>
              onFormChange({ ...form, reason: event.target.value })
            }
            required
            value={form.reason}
          />
        </label>
      ) : (
        <label>
          <span>Note</span>
          <textarea
            maxLength={500}
            onChange={(event) =>
              onFormChange({ ...form, note: event.target.value })
            }
            value={form.note}
          />
        </label>
      )}
      <label>
        <span>Reference</span>
        <input
          maxLength={120}
          onChange={(event) =>
            onFormChange({ ...form, reference: event.target.value })
          }
          placeholder="Invoice, count sheet, or memo"
          value={form.reference}
        />
      </label>
      <button
        className="button button--primary"
        disabled={mutation.loading}
        type="submit"
      >
        {mutation.loading ? "Saving" : operationButtonLabel(form.operation)}
      </button>
    </form>
  );
}

function LowStockPanel({
  items,
  loading,
}: {
  items: InventoryItem[];
  loading: boolean;
}) {
  const sortedItems = [...items].sort((a, b) => {
    const aStatus = getInventoryStockStatus(a);
    const bStatus = getInventoryStockStatus(b);
    if (aStatus === bStatus) {
      return Number(a.currentStock) - Number(b.currentStock);
    }
    return aStatus === "OUT_OF_STOCK" ? -1 : 1;
  });

  return (
    <section className="panel" aria-labelledby="low-stock-heading">
      <div className="panel-heading">
        <p className="eyebrow">Needs attention</p>
        <h3 id="low-stock-heading">Low and out-of-stock</h3>
      </div>
      {loading ? (
        <LoadingState message="Loading low stock" />
      ) : sortedItems.length === 0 ? (
        <EmptyState title="Stock levels look steady">
          <p>No low-stock or out-of-stock products were returned.</p>
        </EmptyState>
      ) : (
        <ul className="inventory-attention-list">
          {sortedItems.map((item) => {
            const status = getInventoryStockStatus(item);
            return (
              <li key={item.productId}>
                <div>
                  <strong>{item.name}</strong>
                  <span>
                    {formatInventoryQuantity(item.currentStock, item.unit)} /
                    reorder{" "}
                    {formatInventoryQuantity(item.reorderLevel, item.unit)}
                  </span>
                </div>
                <span className={`status-badge status-badge--${status}`}>
                  {stockStatusLabels[status]}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function ProductInventoryPanel({ product }: { product: InventoryItem | null }) {
  return (
    <section className="panel" aria-labelledby="product-stock-heading">
      <div className="panel-heading">
        <p className="eyebrow">Product stock</p>
        <h3 id="product-stock-heading">Selected product</h3>
      </div>
      {!product ? (
        <EmptyState title="No product selected">
          <p>
            Choose “View stock” from the inventory list for product-level
            details.
          </p>
        </EmptyState>
      ) : (
        <dl className="inventory-detail-list">
          <div>
            <dt>Product</dt>
            <dd>{product.name}</dd>
          </div>
          <div>
            <dt>SKU</dt>
            <dd>{product.sku}</dd>
          </div>
          <div>
            <dt>Current stock</dt>
            <dd>
              {formatInventoryQuantity(product.currentStock, product.unit)}
            </dd>
          </div>
          <div>
            <dt>Reorder level</dt>
            <dd>
              {formatInventoryQuantity(product.reorderLevel, product.unit)}
            </dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>
              <span
                className={`status-badge status-badge--${getInventoryStockStatus(
                  product,
                )}`}
              >
                {stockStatusLabels[getInventoryStockStatus(product)]}
              </span>
            </dd>
          </div>
        </dl>
      )}
    </section>
  );
}

function MovementHistoryPanel({
  error,
  filters,
  inventory,
  loading,
  movements,
  onFilterChange,
}: {
  error: string | null;
  filters: MovementListFilters;
  inventory: InventoryItem[];
  loading: boolean;
  movements: StockMovement[];
  onFilterChange(filters: MovementListFilters): void;
}) {
  return (
    <section className="panel" aria-labelledby="movement-heading">
      <div className="panel-heading">
        <p className="eyebrow">Audit trail</p>
        <h3 id="movement-heading">Stock movement history</h3>
      </div>
      <div className="movement-filters">
        <label>
          <span>Product</span>
          <select
            onChange={(event) =>
              onFilterChange({ ...filters, productId: event.target.value })
            }
            value={filters.productId}
          >
            <option value="">All products</option>
            {inventory.map((item) => (
              <option key={item.productId} value={item.productId}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Type</span>
          <select
            onChange={(event) =>
              onFilterChange({
                ...filters,
                type: event.target.value as StockMovementType | "",
              })
            }
            value={filters.type}
          >
            <option value="">All types</option>
            {stockMovementTypes.map((type) => (
              <option key={type} value={type}>
                {stockMovementTypeLabels[type]}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>From</span>
          <input
            onChange={(event) =>
              onFilterChange({ ...filters, from: event.target.value })
            }
            type="date"
            value={filters.from}
          />
        </label>
        <label>
          <span>To</span>
          <input
            onChange={(event) =>
              onFilterChange({ ...filters, to: event.target.value })
            }
            type="date"
            value={filters.to}
          />
        </label>
      </div>
      {loading ? (
        <LoadingState message="Loading movement history" />
      ) : error ? (
        <Alert title="Movements unavailable">{error}</Alert>
      ) : movements.length === 0 ? (
        <EmptyState title="No stock movements found">
          <p>Try changing the product, type, or date filters.</p>
        </EmptyState>
      ) : (
        <MovementTable movements={movements} />
      )}
    </section>
  );
}

function MovementTable({ movements }: { movements: StockMovement[] }) {
  return (
    <div className="inventory-table-wrap">
      <table className="inventory-table movement-table">
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">Product</th>
            <th scope="col">Type</th>
            <th scope="col">Quantity</th>
            <th scope="col">Previous</th>
            <th scope="col">New</th>
            <th scope="col">Unit cost</th>
            <th scope="col">Reference</th>
            <th scope="col">By</th>
            <th scope="col">Note</th>
          </tr>
        </thead>
        <tbody>
          {movements.map((movement) => (
            <tr key={movement.id}>
              <td data-label="Date">{formatDateTime(movement.occurredAt)}</td>
              <td data-label="Product">
                <strong>{movement.product?.name ?? movement.productId}</strong>
                <span>{movement.product?.sku ?? "SKU unavailable"}</span>
              </td>
              <td data-label="Type">
                {stockMovementTypeLabels[movement.type] ?? movement.type}
              </td>
              <td data-label="Quantity">
                {formatMovementQuantity(movement, movement.product?.unit)}
              </td>
              <td data-label="Previous">
                {formatInventoryQuantity(
                  movement.previousStock,
                  movement.product?.unit,
                )}
              </td>
              <td data-label="New">
                {formatInventoryQuantity(
                  movement.newStock,
                  movement.product?.unit,
                )}
              </td>
              <td data-label="Unit cost">
                {formatInventoryMoney(movement.unitCost)}
              </td>
              <td data-label="Reference">{movement.reference ?? "None"}</td>
              <td data-label="By">
                {movement.createdBy
                  ? `${movement.createdBy.name} (${movement.createdBy.role})`
                  : "System"}
              </td>
              <td data-label="Note">{movement.note ?? "None"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function operationButtonLabel(operation: InventoryOperation) {
  if (operation === "receive") {
    return "Receive stock";
  }
  if (operation === "adjust") {
    return "Record adjustment";
  }
  if (operation === "return") {
    return "Record return";
  }
  return "Record damage";
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatMovementQuantity(
  movement: StockMovement,
  unit: ProductUnit | undefined,
) {
  const sign =
    movement.type === "DAMAGE" || movement.type === "SOLD" ? "-" : "+";
  const adjustmentSign =
    movement.type === "ADJUSTMENT" &&
    Number(movement.newStock) < Number(movement.previousStock)
      ? "-"
      : sign;
  return `${adjustmentSign}${formatInventoryQuantity(movement.quantity, unit)}`;
}
