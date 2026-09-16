import { useState, type FormEvent } from "react";
import type { Product, ProductCategory, ProductUnit } from "../api/types";
import { hasPermission, permissions } from "../auth/permissions";
import { useAuth } from "../auth/useAuth";
import { Alert, EmptyState, LoadingState } from "../components/Feedback";
import {
  formatMoney,
  formatQuantity,
  getUnitForCategory,
  isValidCategoryUnit,
  productCategories,
  productCategoryLabels,
  productUnitLabels,
  productUnits,
} from "./product-utils";
import {
  emptyProductForm,
  type ProductFormState,
  toFormState,
  toProductInput,
} from "./product-form";
import {
  type ProductListFilters,
  type ProductMutationStatus,
  useProducts,
} from "./useProducts";

export function ProductPage() {
  const auth = useAuth();
  const canManage = hasPermission(auth.user, permissions.MANAGE_PRODUCTS);
  const {
    createProduct,
    deactivateProduct,
    error,
    filters,
    loading,
    mutation,
    products,
    setFilters,
    updateProduct,
  } = useProducts();
  const [form, setForm] = useState<ProductFormState>(emptyProductForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmProduct, setConfirmProduct] = useState<Product | null>(null);

  async function submitProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const input = toProductInput(form);
    if (!input.ok) {
      setFormError(input.message);
      return;
    }

    const succeeded = form.id
      ? await updateProduct(form.id, input.value)
      : await createProduct(input.value);

    if (succeeded) {
      setForm(emptyProductForm);
    }
  }

  async function confirmDeactivation() {
    if (!confirmProduct) {
      return;
    }

    const succeeded = await deactivateProduct(confirmProduct.id);
    if (succeeded) {
      setConfirmProduct(null);
    }
  }

  return (
    <ProductManagementView
      canManage={canManage}
      confirmProduct={confirmProduct}
      error={error}
      filters={filters}
      form={form}
      formError={formError}
      loading={loading}
      mutation={mutation}
      onCancelEdit={() => {
        setForm(emptyProductForm);
        setFormError(null);
      }}
      onConfirmDeactivate={() => void confirmDeactivation()}
      onEditProduct={(product) => {
        setForm(toFormState(product));
        setFormError(null);
      }}
      onFilterChange={setFilters}
      onFormChange={setForm}
      onRequestDeactivate={setConfirmProduct}
      onSubmitProduct={(event) => void submitProduct(event)}
      products={products}
    />
  );
}

export function ProductManagementView({
  canManage,
  confirmProduct,
  error,
  filters,
  form,
  formError,
  loading,
  mutation,
  onCancelEdit,
  onConfirmDeactivate,
  onEditProduct,
  onFilterChange,
  onFormChange,
  onRequestDeactivate,
  onSubmitProduct,
  products,
}: {
  canManage: boolean;
  confirmProduct: Product | null;
  error: string | null;
  filters: ProductListFilters;
  form: ProductFormState;
  formError: string | null;
  loading: boolean;
  mutation: ProductMutationStatus;
  onCancelEdit(): void;
  onConfirmDeactivate(): void;
  onEditProduct(product: Product): void;
  onFilterChange(filters: ProductListFilters): void;
  onFormChange(form: ProductFormState): void;
  onRequestDeactivate(product: Product | null): void;
  onSubmitProduct(event: FormEvent<HTMLFormElement>): void;
  products: Product[];
}) {
  return (
    <div className="product-grid">
      <section
        className="dashboard-hero product-hero"
        aria-labelledby="product-title"
      >
        <div>
          <p className="eyebrow">Catalog</p>
          <h2 id="product-title">Product management</h2>
          <p>
            Manage product identity, category, pricing, reorder levels, and
            active status. Stock changes stay in the inventory workflow.
          </p>
        </div>
        <div className="product-note">
          <strong>Stock is read-only here.</strong>
          <span>Receive or adjust stock from Inventory.</span>
        </div>
      </section>

      <section className="panel product-filters" aria-label="Product filters">
        <label>
          <span>Search</span>
          <input
            onChange={(event) =>
              onFilterChange({ ...filters, search: event.target.value })
            }
            placeholder="Name or SKU"
            type="search"
            value={filters.search}
          />
        </label>
        <label>
          <span>Category</span>
          <select
            onChange={(event) =>
              onFilterChange({
                ...filters,
                category: event.target.value as ProductCategory | "",
              })
            }
            value={filters.category}
          >
            <option value="">All categories</option>
            {productCategories.map((category) => (
              <option key={category} value={category}>
                {productCategoryLabels[category]}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Unit</span>
          <select
            onChange={(event) =>
              onFilterChange({
                ...filters,
                unit: event.target.value as ProductUnit | "",
              })
            }
            value={filters.unit}
          >
            <option value="">All units</option>
            {productUnits.map((unit) => (
              <option key={unit} value={unit}>
                {productUnitLabels[unit]}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Status</span>
          <select
            onChange={(event) =>
              onFilterChange({
                ...filters,
                status:
                  event.target.value === "inactive" ? "inactive" : "active",
              })
            }
            value={filters.status}
          >
            <option value="active">Active products</option>
            <option value="inactive">Inactive products</option>
          </select>
        </label>
      </section>

      {mutation.message ? (
        <Alert title="Saved" variant="info">
          {mutation.message}
        </Alert>
      ) : null}
      {mutation.error ? (
        <Alert title="Product action failed">{mutation.error}</Alert>
      ) : null}

      <div className="product-layout">
        <section
          className="panel product-list-panel"
          aria-labelledby="products-heading"
        >
          <div className="panel-heading">
            <p className="eyebrow">Products</p>
            <h3 id="products-heading">Catalog list</h3>
          </div>
          {loading ? (
            <LoadingState message="Loading products" />
          ) : error ? (
            <Alert title="Products unavailable">{error}</Alert>
          ) : products.length === 0 ? (
            <EmptyState title="No products found">
              <p>Try a different search, category, unit, or status filter.</p>
            </EmptyState>
          ) : (
            <ProductTable
              canManage={canManage}
              onEditProduct={onEditProduct}
              onRequestDeactivate={onRequestDeactivate}
              products={products}
            />
          )}
        </section>

        <section
          className="panel product-form-panel"
          aria-labelledby="product-form-title"
        >
          <div className="panel-heading">
            <p className="eyebrow">{form.id ? "Edit" : "Create"}</p>
            <h3 id="product-form-title">
              {canManage
                ? form.id
                  ? "Edit product"
                  : "Add product"
                : "Management access"}
            </h3>
          </div>
          {canManage ? (
            <ProductForm
              form={form}
              formError={formError}
              mutation={mutation}
              onCancelEdit={onCancelEdit}
              onFormChange={onFormChange}
              onSubmitProduct={onSubmitProduct}
            />
          ) : (
            <EmptyState title="Read-only product access">
              <p>
                Your role can view products but cannot create, edit, or
                deactivate them.
              </p>
            </EmptyState>
          )}
        </section>
      </div>

      {confirmProduct ? (
        <section
          aria-labelledby="deactivate-title"
          aria-modal="true"
          className="confirm-backdrop"
          role="dialog"
        >
          <div className="confirm-dialog">
            <p className="eyebrow">Deactivate product</p>
            <h3 id="deactivate-title">{confirmProduct.name}</h3>
            <p>
              Deactivation removes this product from active operations without
              deleting historical sales or inventory records.
            </p>
            <div className="confirm-actions">
              <button
                className="button button--quiet"
                onClick={() => onRequestDeactivate(null)}
                type="button"
              >
                Cancel
              </button>
              <button
                className="button button--danger"
                disabled={mutation.loading}
                onClick={onConfirmDeactivate}
                type="button"
              >
                Deactivate product
              </button>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function ProductTable({
  canManage,
  onEditProduct,
  onRequestDeactivate,
  products,
}: {
  canManage: boolean;
  onEditProduct(product: Product): void;
  onRequestDeactivate(product: Product): void;
  products: Product[];
}) {
  return (
    <div className="product-table-wrap">
      <table className="product-table">
        <thead>
          <tr>
            <th scope="col">Product</th>
            <th scope="col">Category</th>
            <th scope="col">Unit</th>
            <th scope="col">Cost</th>
            <th scope="col">Selling</th>
            <th scope="col">Stock</th>
            <th scope="col">Reorder</th>
            <th scope="col">Status</th>
            {canManage ? <th scope="col">Actions</th> : null}
          </tr>
        </thead>
        <tbody>
          {products.map((product) => (
            <tr key={product.id}>
              <td data-label="Product">
                <strong>{product.name}</strong>
                <span>{product.sku}</span>
              </td>
              <td data-label="Category">
                {productCategoryLabels[product.category]}
              </td>
              <td data-label="Unit">{productUnitLabels[product.unit]}</td>
              <td data-label="Cost">{formatMoney(product.costPrice)}</td>
              <td data-label="Selling">{formatMoney(product.sellingPrice)}</td>
              <td data-label="Stock">
                {formatQuantity(product.currentStock)}{" "}
                {product.unit.toLowerCase()}
              </td>
              <td data-label="Reorder">
                {formatQuantity(product.reorderLevel)}
              </td>
              <td data-label="Status">
                <span
                  className={
                    product.active
                      ? "status-badge status-badge--IN_STOCK"
                      : "status-badge status-badge--OUT_OF_STOCK"
                  }
                >
                  {product.active ? "Active" : "Inactive"}
                </span>
              </td>
              {canManage ? (
                <td data-label="Actions">
                  <div className="table-actions">
                    <button
                      className="button button--quiet"
                      onClick={() => onEditProduct(product)}
                      type="button"
                    >
                      Edit
                    </button>
                    {product.active ? (
                      <button
                        className="button button--danger-quiet"
                        onClick={() => onRequestDeactivate(product)}
                        type="button"
                      >
                        Deactivate
                      </button>
                    ) : null}
                  </div>
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ProductForm({
  form,
  formError,
  mutation,
  onCancelEdit,
  onFormChange,
  onSubmitProduct,
}: {
  form: ProductFormState;
  formError: string | null;
  mutation: ProductMutationStatus;
  onCancelEdit(): void;
  onFormChange(form: ProductFormState): void;
  onSubmitProduct(event: FormEvent<HTMLFormElement>): void;
}) {
  const validUnit = getUnitForCategory(form.category);
  const unitMismatch = !isValidCategoryUnit(form.category, form.unit);

  return (
    <form className="form-stack product-form" onSubmit={onSubmitProduct}>
      {formError ? (
        <Alert title="Check product details">{formError}</Alert>
      ) : null}
      {unitMismatch ? (
        <Alert title="Unit corrected" variant="info">
          {productCategoryLabels[form.category]} products use{" "}
          {productUnitLabels[validUnit]}.
        </Alert>
      ) : null}
      <label>
        <span>Product name *</span>
        <input
          maxLength={120}
          onChange={(event) =>
            onFormChange({ ...form, name: event.target.value })
          }
          required
          value={form.name}
        />
      </label>
      <label>
        <span>SKU *</span>
        <input
          maxLength={64}
          onChange={(event) =>
            onFormChange({ ...form, sku: event.target.value.toUpperCase() })
          }
          pattern="[A-Za-z0-9_-]+"
          required
          value={form.sku}
        />
        <small>
          Saved uppercase. Use letters, numbers, hyphens, or underscores.
        </small>
      </label>
      <div className="form-row">
        <label>
          <span>Category *</span>
          <select
            onChange={(event) => {
              const category = event.target.value as ProductCategory;
              onFormChange({
                ...form,
                category,
                unit: getUnitForCategory(category),
              });
            }}
            required
            value={form.category}
          >
            {productCategories.map((category) => (
              <option key={category} value={category}>
                {productCategoryLabels[category]}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Unit</span>
          <select
            aria-describedby="unit-help"
            onChange={(event) =>
              onFormChange({ ...form, unit: event.target.value as ProductUnit })
            }
            value={validUnit}
          >
            <option value={validUnit}>{productUnitLabels[validUnit]}</option>
          </select>
          <small id="unit-help">Unit is determined by category.</small>
        </label>
      </div>
      <div className="form-row">
        <label>
          <span>Cost price *</span>
          <input
            min="0"
            onChange={(event) =>
              onFormChange({ ...form, costPrice: event.target.value })
            }
            required
            step="0.01"
            type="number"
            value={form.costPrice}
          />
        </label>
        <label>
          <span>Selling price *</span>
          <input
            min="0"
            onChange={(event) =>
              onFormChange({ ...form, sellingPrice: event.target.value })
            }
            required
            step="0.01"
            type="number"
            value={form.sellingPrice}
          />
        </label>
      </div>
      <label>
        <span>Reorder level *</span>
        <input
          min="0"
          onChange={(event) =>
            onFormChange({ ...form, reorderLevel: event.target.value })
          }
          required
          step="0.001"
          type="number"
          value={form.reorderLevel}
        />
      </label>
      <div className="form-actions">
        {form.id ? (
          <button
            className="button button--quiet"
            onClick={onCancelEdit}
            type="button"
          >
            Cancel
          </button>
        ) : null}
        <button
          className="button button--primary"
          disabled={mutation.loading}
          type="submit"
        >
          {mutation.loading
            ? "Saving"
            : form.id
              ? "Update product"
              : "Create product"}
        </button>
      </div>
    </form>
  );
}
