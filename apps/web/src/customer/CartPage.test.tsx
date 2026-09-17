import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { CartView } from "./CartPage";
import { summarizeCustomerCart, type CustomerCartItem } from "./cart-utils";
import { buildCreateOrderInput } from "./order-utils";

const cartItems: CustomerCartItem[] = [
  {
    productId: "product_1",
    name: "Monumental Drinks Pack",
    sku: "DRINK-001",
    category: "DRINKS",
    unit: "PACK",
    sellingPrice: "3500.00",
    quantity: 2,
  },
  {
    productId: "product_2",
    name: "Sugar Cup",
    sku: "SUGAR-001",
    category: "SUGAR",
    unit: "CUP",
    sellingPrice: "250.00",
    quantity: 3,
  },
];

function renderCart(items: CustomerCartItem[] = cartItems) {
  return renderToStaticMarkup(
    <CartView
      items={items}
      onContinueShopping={vi.fn()}
      onDecreaseQuantity={vi.fn()}
      onIncreaseQuantity={vi.fn()}
      onPlaceOrder={vi.fn()}
      onRemoveItem={vi.fn()}
      onUpdateQuantity={vi.fn()}
      summary={summarizeCustomerCart(items)}
    />,
  );
}

describe("CartView", () => {
  it("renders cart products, quantity controls, and removal actions", () => {
    const html = renderCart();

    expect(html).toContain("Review your cart");
    expect(html).toContain("Monumental Drinks Pack");
    expect(html).toContain("Code DRINK-001");
    expect(html).toContain("Quantity for Monumental Drinks Pack");
    expect(html).toContain("Decrease Monumental Drinks Pack");
    expect(html).toContain("Increase Monumental Drinks Pack");
    expect(html).toContain("Remove Monumental Drinks Pack");
    expect(html).toContain("Line subtotal");
  });

  it("renders item count, total quantity, and cart subtotal", () => {
    const html = renderCart();

    expect(html).toContain("Distinct product lines");
    expect(html).toContain("<dd>2</dd>");
    expect(html).toContain("Total quantity");
    expect(html).toContain("<dd>5</dd>");
    expect(html).toContain("Cart subtotal");
    expect(html).toContain("₦7,750.00");
    expect(html).toContain("cart subtotal preview");
    expect(html).toContain("Place Order");
  });

  it("renders a useful empty cart state with a continue shopping action", () => {
    const html = renderCart([]);

    expect(html).toContain("Your cart is empty");
    expect(html).toContain("Continue shopping");
    expect(html).toContain("Add products from the Monumental Details shop");
  });

  it("uses a mobile-friendly cart list rather than a wide table", () => {
    const html = renderCart();

    expect(html).toContain("customer-cart-lines");
    expect(html).not.toContain("<table");
  });

  it("shows order submission loading and API error states without hiding cart items", () => {
    const loadingHtml = renderToStaticMarkup(
      <CartView
        items={cartItems}
        onContinueShopping={vi.fn()}
        onDecreaseQuantity={vi.fn()}
        onIncreaseQuantity={vi.fn()}
        onPlaceOrder={vi.fn()}
        onRemoveItem={vi.fn()}
        onUpdateQuantity={vi.fn()}
        summary={summarizeCustomerCart(cartItems)}
        submittingOrder
      />,
    );
    const errorHtml = renderToStaticMarkup(
      <CartView
        items={cartItems}
        onContinueShopping={vi.fn()}
        onDecreaseQuantity={vi.fn()}
        onIncreaseQuantity={vi.fn()}
        onPlaceOrder={vi.fn()}
        onRemoveItem={vi.fn()}
        onUpdateQuantity={vi.fn()}
        orderError="One or more cart items are no longer available."
        summary={summarizeCustomerCart(cartItems)}
      />,
    );

    expect(loadingHtml).toContain("Placing order");
    expect(loadingHtml).toContain("disabled");
    expect(errorHtml).toContain("Order could not be placed");
    expect(errorHtml).toContain("Monumental Drinks Pack");
  });

  it("builds an order request from product IDs and quantities only", () => {
    const payload = buildCreateOrderInput(cartItems);

    expect(payload).toEqual({
      items: [
        { productId: "product_1", quantity: 2 },
        { productId: "product_2", quantity: 3 },
      ],
    });
    expect(JSON.stringify(payload)).not.toContain("sellingPrice");
    expect(JSON.stringify(payload)).not.toContain("subtotal");
    expect(JSON.stringify(payload)).not.toContain("customerId");
    expect(JSON.stringify(payload)).not.toContain("reference");
  });
});
