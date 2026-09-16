import type {
  CreateSaleInput,
  PaymentMethod,
  PaymentStatus,
  Product,
} from "../api/types";
import { formatMoney, formatQuantity } from "../products/product-utils";

export type CartLine = {
  product: Product;
  quantity: number;
};

export const paymentMethods: PaymentMethod[] = [
  "CASH",
  "TRANSFER",
  "CARD",
  "OTHER",
];

export const paymentStatuses: PaymentStatus[] = ["PAID", "PENDING"];

export const paymentMethodLabels: Record<PaymentMethod, string> = {
  CASH: "Cash",
  TRANSFER: "Transfer",
  CARD: "Card",
  OTHER: "Other",
};

export const paymentStatusLabels: Record<PaymentStatus, string> = {
  PAID: "Paid",
  PENDING: "Pending",
};

export function addProductToCart(
  cart: CartLine[],
  product: Product,
  quantity: number,
) {
  const existingLine = cart.find((line) => line.product.id === product.id);
  if (!existingLine) {
    return [...cart, { product, quantity }];
  }

  return cart.map((line) =>
    line.product.id === product.id
      ? { ...line, quantity: roundQuantity(line.quantity + quantity) }
      : line,
  );
}

export function updateCartQuantity(
  cart: CartLine[],
  productId: string,
  quantity: number,
) {
  if (quantity <= 0) {
    return cart.filter((line) => line.product.id !== productId);
  }

  return cart.map((line) =>
    line.product.id === productId ? { ...line, quantity } : line,
  );
}

export function removeCartLine(cart: CartLine[], productId: string) {
  return cart.filter((line) => line.product.id !== productId);
}

export function getCartSubtotal(cart: CartLine[]) {
  return roundMoney(
    cart.reduce(
      (total, line) =>
        total + line.quantity * Number(line.product.sellingPrice),
      0,
    ),
  );
}

export function getCartTotal(cart: CartLine[], discountAmount: number) {
  return roundMoney(Math.max(0, getCartSubtotal(cart) - discountAmount));
}

export function validateCartLine(product: Product, quantity: number) {
  if (!product.active) {
    return "Inactive products cannot be added to a sale.";
  }
  if (Number.isNaN(quantity) || quantity <= 0) {
    return "Quantity must be greater than zero.";
  }
  if (quantity > Number(product.currentStock)) {
    return "Quantity is above the stock currently displayed. The backend will re-check stock at checkout.";
  }
  return null;
}

export function toCreateSaleInput(input: {
  cart: CartLine[];
  discountAmount: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  paymentReference: string;
}): { ok: true; value: CreateSaleInput } | { ok: false; message: string } {
  if (input.cart.length === 0) {
    return {
      ok: false,
      message: "Add at least one product before completing a sale.",
    };
  }

  for (const line of input.cart) {
    if (line.quantity <= 0 || Number.isNaN(line.quantity)) {
      return { ok: false, message: "Every cart item needs a valid quantity." };
    }
  }

  if (Number.isNaN(input.discountAmount) || input.discountAmount < 0) {
    return { ok: false, message: "Discount must be zero or greater." };
  }

  const subtotal = getCartSubtotal(input.cart);
  if (input.discountAmount > subtotal) {
    return { ok: false, message: "Discount cannot exceed the sale subtotal." };
  }

  return {
    ok: true,
    value: {
      paymentMethod: input.paymentMethod,
      paymentStatus: input.paymentStatus,
      paymentReference: optionalText(input.paymentReference),
      discountAmount: input.discountAmount,
      items: input.cart.map((line) => ({
        productId: line.product.id,
        quantity: line.quantity,
      })),
    },
  };
}

export function saleErrorMessage(error: {
  code?: string;
  status?: number;
  message?: string;
}) {
  if (error.code === "INSUFFICIENT_STOCK" || error.status === 409) {
    return "Insufficient stock. Refresh products, adjust the cart, and try again.";
  }
  if (error.code === "INVALID_DISCOUNT") {
    return "Discount cannot exceed the sale subtotal.";
  }
  if (error.code === "PRODUCT_NOT_FOUND" || error.status === 404) {
    return "One or more products are inactive or unavailable.";
  }
  if (error.status === 401) {
    return "Your session has expired. Sign in again to continue.";
  }
  if (error.status === 403) {
    return "Your account does not have permission to complete sales.";
  }
  if (error.status === 400) {
    return "Check the sale details and try again.";
  }
  return "The sale could not be completed.";
}

export function formatCartQuantity(quantity: number, product: Product) {
  return `${formatQuantity(quantity)} ${product.unit.toLowerCase()}`;
}

export function formatCartMoney(value: string | number) {
  return formatMoney(value);
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function roundQuantity(value: number) {
  return Math.round((value + Number.EPSILON) * 1000) / 1000;
}

function optionalText(value: string) {
  const trimmed = value.trim();
  return trimmed || undefined;
}
