import { useRef, useState } from "react";
import { ApiError, apiClient } from "../api/client";
import { EmptyState } from "../components/Feedback";
import { formatMoney } from "../products/product-utils";
import { navigate } from "../routing/useBrowserRoute";
import { routes } from "../routing/routes";
import { type CartSummary, type CustomerCartItem } from "./cart-utils";
import { buildCreateOrderInput, orderDisplayError } from "./order-utils";
import { useCustomerCart } from "./useCustomerCart";

export function CartPage() {
  const cart = useCustomerCart();
  const submittingRef = useRef(false);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submitOrder() {
    if (submittingRef.current) {
      return;
    }
    if (cart.items.length === 0) {
      setOrderError("Add at least one product before placing an order.");
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);
    setOrderError(null);
    try {
      const order = await apiClient.createOrder(
        buildCreateOrderInput(cart.items),
      );
      cart.clearCart();
      navigate(`/orders/${order.id}`);
    } catch (error) {
      setOrderError(
        error instanceof ApiError
          ? orderDisplayError(error)
          : "Your order could not be placed. Please try again.",
      );
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  return (
    <CartView
      items={cart.items}
      onContinueShopping={() => navigate(routes.shop.path)}
      onDecreaseQuantity={cart.decreaseQuantity}
      onIncreaseQuantity={cart.increaseQuantity}
      onPlaceOrder={() => void submitOrder()}
      onRemoveItem={cart.removeItem}
      onUpdateQuantity={cart.updateQuantity}
      orderError={orderError}
      summary={cart.summary}
      submittingOrder={submitting}
    />
  );
}

export function CartView({
  items,
  onContinueShopping,
  onDecreaseQuantity,
  onIncreaseQuantity,
  onPlaceOrder,
  onRemoveItem,
  onUpdateQuantity,
  orderError = null,
  summary,
  submittingOrder = false,
}: {
  items: CustomerCartItem[];
  onContinueShopping(): void;
  onDecreaseQuantity(productId: string): void;
  onIncreaseQuantity(productId: string): void;
  onPlaceOrder(): void;
  onRemoveItem(productId: string): void;
  onUpdateQuantity(productId: string, quantity: number): void;
  orderError?: string | null;
  summary: CartSummary;
  submittingOrder?: boolean;
}) {
  return (
    <div className="cart-grid">
      <section
        className="dashboard-hero cart-hero"
        aria-labelledby="cart-title"
      >
        <div>
          <p className="eyebrow">Customer cart</p>
          <h2 id="cart-title">Review your cart</h2>
          <p>
            Adjust quantities before placing your order. Prices shown here are a
            cart subtotal preview; the backend confirms the order total.
          </p>
        </div>
        <div className="shop-note">
          <strong>Backend validated</strong>
          <span>
            Product availability and prices are checked again when you place the
            order.
          </span>
        </div>
      </section>

      {orderError ? (
        <div className="alert alert--error" role="alert">
          <strong>Order could not be placed</strong>
          <span>{orderError}</span>
        </div>
      ) : null}

      {items.length === 0 ? (
        <EmptyCart onContinueShopping={onContinueShopping} />
      ) : (
        <div className="cart-layout">
          <section
            className="panel cart-lines-panel"
            aria-labelledby="cart-lines-heading"
          >
            <div className="panel-heading">
              <p className="eyebrow">Items</p>
              <h3 id="cart-lines-heading">Cart products</h3>
            </div>
            <ul className="customer-cart-lines" aria-live="polite">
              {items.map((item) => (
                <CartLine
                  item={item}
                  key={item.productId}
                  onDecreaseQuantity={onDecreaseQuantity}
                  onIncreaseQuantity={onIncreaseQuantity}
                  onRemoveItem={onRemoveItem}
                  onUpdateQuantity={onUpdateQuantity}
                />
              ))}
            </ul>
          </section>

          <CartSummaryPanel
            onContinueShopping={onContinueShopping}
            onPlaceOrder={onPlaceOrder}
            summary={summary}
            submittingOrder={submittingOrder}
          />
        </div>
      )}
    </div>
  );
}

function EmptyCart({ onContinueShopping }: { onContinueShopping(): void }) {
  return (
    <EmptyState title="Your cart is empty">
      <p>Add products from the Monumental Details shop catalog.</p>
      <button
        className="button button--primary fit-content"
        onClick={onContinueShopping}
        type="button"
      >
        Continue shopping
      </button>
    </EmptyState>
  );
}

function CartLine({
  item,
  onDecreaseQuantity,
  onIncreaseQuantity,
  onRemoveItem,
  onUpdateQuantity,
}: {
  item: CustomerCartItem;
  onDecreaseQuantity(productId: string): void;
  onIncreaseQuantity(productId: string): void;
  onRemoveItem(productId: string): void;
  onUpdateQuantity(productId: string, quantity: number): void;
}) {
  return (
    <li>
      <div className="customer-cart-product">
        <strong>{item.name}</strong>
        <span>
          Code {item.sku} · {item.unit.toLowerCase()} ·{" "}
          {formatMoney(item.sellingPrice)}
        </span>
      </div>
      <div className="customer-cart-controls">
        <button
          className="button button--quiet"
          onClick={() => onDecreaseQuantity(item.productId)}
          type="button"
        >
          Decrease {item.name}
        </button>
        <label>
          <span>Quantity for {item.name}</span>
          <input
            min="1"
            onChange={(event) =>
              onUpdateQuantity(item.productId, Number(event.target.value))
            }
            step="1"
            type="number"
            value={item.quantity}
          />
        </label>
        <button
          className="button button--quiet"
          onClick={() => onIncreaseQuantity(item.productId)}
          type="button"
        >
          Increase {item.name}
        </button>
        <button
          className="button button--danger-quiet"
          onClick={() => onRemoveItem(item.productId)}
          type="button"
        >
          Remove {item.name}
        </button>
      </div>
      <div className="customer-cart-line-total">
        <span>Line subtotal</span>
        <strong>
          {formatMoney(Number(item.sellingPrice) * item.quantity)}
        </strong>
      </div>
    </li>
  );
}

function CartSummaryPanel({
  onContinueShopping,
  onPlaceOrder,
  summary,
  submittingOrder,
}: {
  onContinueShopping(): void;
  onPlaceOrder(): void;
  summary: CartSummary;
  submittingOrder: boolean;
}) {
  return (
    <aside
      className="panel customer-cart-summary"
      aria-labelledby="cart-summary-heading"
    >
      <div className="panel-heading">
        <p className="eyebrow">Summary</p>
        <h3 id="cart-summary-heading">Cart subtotal</h3>
      </div>
      <dl className="cart-totals">
        <div>
          <dt>Distinct product lines</dt>
          <dd>{summary.distinctProducts}</dd>
        </div>
        <div>
          <dt>Total quantity</dt>
          <dd>{summary.totalQuantity}</dd>
        </div>
        <div>
          <dt>Cart subtotal</dt>
          <dd>{formatMoney(summary.subtotal)}</dd>
        </div>
      </dl>
      <p className="cart-boundary-note">
        This is a cart subtotal preview. The backend will revalidate products,
        prices, and availability before creating the order.
      </p>
      <button
        className="button button--primary"
        disabled={submittingOrder}
        onClick={onPlaceOrder}
        type="button"
      >
        {submittingOrder ? "Placing order" : "Place Order"}
      </button>
      <button
        className="button button--quiet"
        disabled={submittingOrder}
        onClick={onContinueShopping}
        type="button"
      >
        Continue shopping
      </button>
    </aside>
  );
}
