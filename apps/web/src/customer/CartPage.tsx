import { EmptyState } from "../components/Feedback";
import { formatMoney } from "../products/product-utils";
import { navigate } from "../routing/useBrowserRoute";
import { routes } from "../routing/routes";
import { type CartSummary, type CustomerCartItem } from "./cart-utils";
import { useCustomerCart } from "./useCustomerCart";

export function CartPage() {
  const cart = useCustomerCart();

  return (
    <CartView
      items={cart.items}
      onContinueShopping={() => navigate(routes.shop.path)}
      onDecreaseQuantity={cart.decreaseQuantity}
      onIncreaseQuantity={cart.increaseQuantity}
      onRemoveItem={cart.removeItem}
      onUpdateQuantity={cart.updateQuantity}
      summary={cart.summary}
    />
  );
}

export function CartView({
  items,
  onContinueShopping,
  onDecreaseQuantity,
  onIncreaseQuantity,
  onRemoveItem,
  onUpdateQuantity,
  summary,
}: {
  items: CustomerCartItem[];
  onContinueShopping(): void;
  onDecreaseQuantity(productId: string): void;
  onIncreaseQuantity(productId: string): void;
  onRemoveItem(productId: string): void;
  onUpdateQuantity(productId: string, quantity: number): void;
  summary: CartSummary;
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
            Adjust quantities before the future checkout workflow. Prices shown
            here are a cart subtotal preview.
          </p>
        </div>
        <div className="shop-note">
          <strong>No checkout yet</strong>
          <span>
            Orders, payment, and final validation will be added later.
          </span>
        </div>
      </section>

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
            summary={summary}
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
  summary,
}: {
  onContinueShopping(): void;
  summary: CartSummary;
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
        This is not a final total. Future checkout will revalidate products,
        prices, and availability on the backend.
      </p>
      <button
        className="button button--primary"
        onClick={onContinueShopping}
        type="button"
      >
        Continue shopping
      </button>
    </aside>
  );
}
