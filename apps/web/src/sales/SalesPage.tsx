import { useState, type FormEvent } from "react";
import type {
  PaymentMethod,
  PaymentStatus,
  Product,
  ProductCategory,
  Sale,
} from "../api/types";
import { Alert, EmptyState, LoadingState } from "../components/Feedback";
import {
  productCategories,
  productCategoryLabels,
  productUnitLabels,
} from "../products/product-utils";
import {
  formatCartMoney,
  formatCartQuantity,
  paymentMethodLabels,
  paymentMethods,
  paymentStatusLabels,
  paymentStatuses,
  validateCartLine,
  type CartLine,
} from "./pos-utils";
import {
  type CheckoutFields,
  type PosProductFilters,
  type SaleMutationStatus,
  usePos,
} from "./usePos";

export function SalesPage({ onOpenSale }: { onOpenSale(id: string): void }) {
  const {
    addToCart,
    cart,
    checkout,
    completedSale,
    filters,
    formError,
    loadingProducts,
    lookupError,
    mutation,
    products,
    removeFromCart,
    setCheckout,
    setFilters,
    submitSale,
    subtotal,
    total,
    updateQuantity,
  } = usePos();
  const [quantityDrafts, setQuantityDrafts] = useState<Record<string, string>>(
    {},
  );

  function quantityForProduct(product: Product) {
    return quantityDrafts[product.id] ?? "1";
  }

  function addProduct(product: Product) {
    const quantity = Number(quantityForProduct(product));
    if (addToCart(product, quantity)) {
      setQuantityDrafts((drafts) => ({ ...drafts, [product.id]: "1" }));
    }
  }

  return (
    <PosView
      cart={cart}
      checkout={checkout}
      completedSale={completedSale}
      filters={filters}
      formError={formError}
      loadingProducts={loadingProducts}
      lookupError={lookupError}
      mutation={mutation}
      onAddProduct={addProduct}
      onCheckoutChange={setCheckout}
      onCompleteSale={() => void submitSale()}
      onFilterChange={setFilters}
      onOpenSale={onOpenSale}
      onQuantityDraftChange={(productId, quantity) =>
        setQuantityDrafts((drafts) => ({ ...drafts, [productId]: quantity }))
      }
      onRemoveFromCart={removeFromCart}
      onUpdateCartQuantity={updateQuantity}
      products={products}
      quantityDrafts={quantityDrafts}
      subtotal={subtotal}
      total={total}
    />
  );
}

export function PosView({
  cart,
  checkout,
  completedSale,
  filters,
  formError,
  loadingProducts,
  lookupError,
  mutation,
  onAddProduct,
  onCheckoutChange,
  onCompleteSale,
  onFilterChange,
  onOpenSale,
  onQuantityDraftChange,
  onRemoveFromCart,
  onUpdateCartQuantity,
  products,
  quantityDrafts,
  subtotal,
  total,
}: {
  cart: CartLine[];
  checkout: CheckoutFields;
  completedSale: Sale | null;
  filters: PosProductFilters;
  formError: string | null;
  loadingProducts: boolean;
  lookupError: string | null;
  mutation: SaleMutationStatus;
  onAddProduct(product: Product): void;
  onCheckoutChange(checkout: CheckoutFields): void;
  onCompleteSale(): void;
  onFilterChange(filters: PosProductFilters): void;
  onOpenSale(id: string): void;
  onQuantityDraftChange(productId: string, quantity: string): void;
  onRemoveFromCart(productId: string): void;
  onUpdateCartQuantity(productId: string, quantity: number): void;
  products: Product[];
  quantityDrafts: Record<string, string>;
  subtotal: number;
  total: number;
}) {
  return (
    <div className="pos-grid">
      <section className="dashboard-hero pos-hero" aria-labelledby="pos-title">
        <div>
          <p className="eyebrow">Sales</p>
          <h2 id="pos-title">Point of sale</h2>
          <p>
            Find products, build a cart, apply a monetary discount, and let the
            backend complete the sale and update inventory transactionally.
          </p>
        </div>
        <div className="product-note">
          <strong>Backend checkout</strong>
          <span>
            Prices and stock are rechecked when the sale is completed.
          </span>
        </div>
      </section>

      {mutation.message ? (
        <Alert title="Sale completed" variant="info">
          {mutation.message}
        </Alert>
      ) : null}
      {mutation.error ? (
        <Alert title="Sale failed">{mutation.error}</Alert>
      ) : null}
      {formError ? <Alert title="Check sale details">{formError}</Alert> : null}

      {completedSale ? (
        <SaleSuccessPanel onOpenSale={onOpenSale} sale={completedSale} />
      ) : null}

      <div className="pos-main">
        <section
          className="panel pos-products-panel"
          aria-labelledby="lookup-heading"
        >
          <div className="panel-heading">
            <p className="eyebrow">Product lookup</p>
            <h3 id="lookup-heading">Find products</h3>
          </div>
          <ProductLookupFilters
            filters={filters}
            onFilterChange={onFilterChange}
          />
          {loadingProducts ? (
            <LoadingState message="Loading products" />
          ) : lookupError ? (
            <Alert title="Products unavailable">{lookupError}</Alert>
          ) : products.length === 0 ? (
            <EmptyState title="No active products found">
              <p>Try a different name, SKU, or category.</p>
            </EmptyState>
          ) : (
            <ProductLookupList
              onAddProduct={onAddProduct}
              onQuantityDraftChange={onQuantityDraftChange}
              products={products}
              quantityDrafts={quantityDrafts}
            />
          )}
        </section>

        <section
          className="panel pos-cart-panel"
          aria-labelledby="cart-heading"
        >
          <div className="panel-heading">
            <p className="eyebrow">Checkout</p>
            <h3 id="cart-heading">Cart</h3>
          </div>
          <CartPanel
            cart={cart}
            checkout={checkout}
            mutation={mutation}
            onCheckoutChange={onCheckoutChange}
            onCompleteSale={onCompleteSale}
            onRemoveFromCart={onRemoveFromCart}
            onUpdateCartQuantity={onUpdateCartQuantity}
            subtotal={subtotal}
            total={total}
          />
        </section>
      </div>
    </div>
  );
}

function ProductLookupFilters({
  filters,
  onFilterChange,
}: {
  filters: PosProductFilters;
  onFilterChange(filters: PosProductFilters): void;
}) {
  return (
    <section className="pos-filters" aria-label="Product lookup filters">
      <label>
        <span>Search</span>
        <input
          onChange={(event) =>
            onFilterChange({ ...filters, search: event.target.value })
          }
          placeholder="Product name or SKU"
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
    </section>
  );
}

function ProductLookupList({
  onAddProduct,
  onQuantityDraftChange,
  products,
  quantityDrafts,
}: {
  onAddProduct(product: Product): void;
  onQuantityDraftChange(productId: string, quantity: string): void;
  products: Product[];
  quantityDrafts: Record<string, string>;
}) {
  return (
    <div className="pos-product-list">
      {products.map((product) => {
        const quantity = quantityDrafts[product.id] ?? "1";
        const warning = validateCartLine(product, Number(quantity));
        const cannotAdd =
          !product.active ||
          Number.isNaN(Number(quantity)) ||
          Number(quantity) <= 0;
        return (
          <article className="pos-product-row" key={product.id}>
            <div>
              <strong>{product.name}</strong>
              <span>
                {product.sku} · {productUnitLabels[product.unit]} ·{" "}
                {formatCartMoney(product.sellingPrice)}
              </span>
              <span>
                Available:{" "}
                {formatCartQuantity(Number(product.currentStock), product)}
                {!product.active ? " · Inactive" : ""}
              </span>
              {warning ? <em>{warning}</em> : null}
            </div>
            <label>
              <span>Quantity for {product.name}</span>
              <input
                min="0.001"
                onChange={(event) =>
                  onQuantityDraftChange(product.id, event.target.value)
                }
                step="0.001"
                type="number"
                value={quantity}
              />
            </label>
            <button
              className="button button--primary"
              disabled={cannotAdd}
              onClick={() => onAddProduct(product)}
              type="button"
            >
              Add
            </button>
          </article>
        );
      })}
    </div>
  );
}

function CartPanel({
  cart,
  checkout,
  mutation,
  onCheckoutChange,
  onCompleteSale,
  onRemoveFromCart,
  onUpdateCartQuantity,
  subtotal,
  total,
}: {
  cart: CartLine[];
  checkout: CheckoutFields;
  mutation: SaleMutationStatus;
  onCheckoutChange(checkout: CheckoutFields): void;
  onCompleteSale(): void;
  onRemoveFromCart(productId: string): void;
  onUpdateCartQuantity(productId: string, quantity: number): void;
  subtotal: number;
  total: number;
}) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onCompleteSale();
  }

  return (
    <form className="pos-cart" onSubmit={submit}>
      {cart.length === 0 ? (
        <EmptyState title="Cart is empty">
          <p>Add products from lookup to start a sale.</p>
        </EmptyState>
      ) : (
        <ul className="cart-lines" aria-live="polite">
          {cart.map((line) => (
            <li key={line.product.id}>
              <div>
                <strong>{line.product.name}</strong>
                <span>
                  {productUnitLabels[line.product.unit]} ·{" "}
                  {formatCartMoney(line.product.sellingPrice)} each
                </span>
                <span>
                  Line total{" "}
                  {formatCartMoney(
                    line.quantity * Number(line.product.sellingPrice),
                  )}
                </span>
              </div>
              <div className="cart-line-controls">
                <button
                  className="button button--quiet"
                  onClick={() =>
                    onUpdateCartQuantity(line.product.id, line.quantity - 1)
                  }
                  type="button"
                >
                  Decrease {line.product.name}
                </button>
                <label>
                  <span>Quantity for {line.product.name}</span>
                  <input
                    min="0.001"
                    onChange={(event) =>
                      onUpdateCartQuantity(
                        line.product.id,
                        Number(event.target.value),
                      )
                    }
                    step="0.001"
                    type="number"
                    value={line.quantity}
                  />
                </label>
                <button
                  className="button button--quiet"
                  onClick={() =>
                    onUpdateCartQuantity(line.product.id, line.quantity + 1)
                  }
                  type="button"
                >
                  Increase {line.product.name}
                </button>
                <button
                  className="button button--danger-quiet"
                  onClick={() => onRemoveFromCart(line.product.id)}
                  type="button"
                >
                  Remove {line.product.name}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <section className="checkout-fields" aria-label="Checkout details">
        <label>
          <span>Discount amount</span>
          <input
            min="0"
            onChange={(event) =>
              onCheckoutChange({
                ...checkout,
                discountAmount: event.target.value,
              })
            }
            step="0.01"
            type="number"
            value={checkout.discountAmount}
          />
        </label>
        <label>
          <span>Payment method *</span>
          <select
            onChange={(event) =>
              onCheckoutChange({
                ...checkout,
                paymentMethod: event.target.value as PaymentMethod,
              })
            }
            value={checkout.paymentMethod}
          >
            {paymentMethods.map((method) => (
              <option key={method} value={method}>
                {paymentMethodLabels[method]}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Payment status *</span>
          <select
            onChange={(event) =>
              onCheckoutChange({
                ...checkout,
                paymentStatus: event.target.value as PaymentStatus,
              })
            }
            value={checkout.paymentStatus}
          >
            {paymentStatuses.map((status) => (
              <option key={status} value={status}>
                {paymentStatusLabels[status]}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Payment reference</span>
          <input
            maxLength={120}
            onChange={(event) =>
              onCheckoutChange({
                ...checkout,
                paymentReference: event.target.value,
              })
            }
            placeholder="Transfer note or memo"
            value={checkout.paymentReference}
          />
        </label>
      </section>

      <dl className="cart-totals">
        <div>
          <dt>Subtotal</dt>
          <dd>{formatCartMoney(subtotal)}</dd>
        </div>
        <div>
          <dt>Discount</dt>
          <dd>{formatCartMoney(checkout.discountAmount || 0)}</dd>
        </div>
        <div>
          <dt>Total</dt>
          <dd>{formatCartMoney(Number.isNaN(total) ? 0 : total)}</dd>
        </div>
      </dl>

      <button
        className="button button--primary pos-complete"
        disabled={mutation.loading || cart.length === 0}
        type="submit"
      >
        {mutation.loading ? "Completing sale" : "Complete sale"}
      </button>
    </form>
  );
}

function SaleSuccessPanel({
  onOpenSale,
  sale,
}: {
  onOpenSale(id: string): void;
  sale: Sale;
}) {
  return (
    <section
      className="panel sale-success"
      aria-labelledby="sale-success-title"
    >
      <div>
        <p className="eyebrow">Completed</p>
        <h3 id="sale-success-title">{sale.reference}</h3>
        <p>
          {sale.items?.length ?? 0} item line
          {(sale.items?.length ?? 0) === 1 ? "" : "s"} ·{" "}
          {paymentStatusLabels[sale.paymentStatus]} · Total{" "}
          {formatCartMoney(sale.totalAmount)}
        </p>
      </div>
      <div className="sale-success-actions">
        <button
          className="button button--quiet"
          onClick={() => onOpenSale(sale.id)}
          type="button"
        >
          View receipt
        </button>
        <span className="status-badge status-badge--IN_STOCK">
          Ready for next sale
        </span>
      </div>
    </section>
  );
}
