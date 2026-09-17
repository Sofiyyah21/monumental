import type { CustomerCatalogProduct, UserRole } from "../api/types";

export type CustomerCartItem = {
  productId: string;
  name: string;
  sku: string;
  category: CustomerCatalogProduct["category"];
  unit: CustomerCatalogProduct["unit"];
  sellingPrice: string;
  quantity: number;
};

export type CartSummary = {
  distinctProducts: number;
  totalQuantity: number;
  subtotal: number;
};

export function toCartItem(
  product: CustomerCatalogProduct,
  quantity: number,
): CustomerCartItem {
  return {
    productId: product.id,
    name: product.name,
    sku: product.sku,
    category: product.category,
    unit: product.unit,
    sellingPrice: product.sellingPrice,
    quantity: normalizeQuantity(quantity),
  };
}

export function canAddProductToCart(product: CustomerCatalogProduct) {
  return product.availability === "AVAILABLE" && product.id.trim().length > 0;
}

export function addProductToCustomerCart(
  cart: CustomerCartItem[],
  product: CustomerCatalogProduct,
  quantity = 1,
) {
  if (!canAddProductToCart(product)) {
    return cart;
  }

  const normalizedQuantity = normalizeQuantity(quantity);
  if (normalizedQuantity <= 0) {
    return cart;
  }

  const existingLine = cart.find((line) => line.productId === product.id);
  if (!existingLine) {
    return [...cart, toCartItem(product, normalizedQuantity)];
  }

  return cart.map((line) =>
    line.productId === product.id
      ? { ...line, quantity: line.quantity + normalizedQuantity }
      : line,
  );
}

export function updateCustomerCartQuantity(
  cart: CustomerCartItem[],
  productId: string,
  quantity: number,
) {
  const normalizedQuantity = normalizeQuantity(quantity);
  if (normalizedQuantity < 0) {
    return cart;
  }
  if (normalizedQuantity === 0) {
    return removeCustomerCartItem(cart, productId);
  }

  return cart.map((line) =>
    line.productId === productId
      ? { ...line, quantity: normalizedQuantity }
      : line,
  );
}

export function removeCustomerCartItem(
  cart: CustomerCartItem[],
  productId: string,
) {
  return cart.filter((line) => line.productId !== productId);
}

export function summarizeCustomerCart(cart: CustomerCartItem[]): CartSummary {
  return {
    distinctProducts: cart.length,
    totalQuantity: cart.reduce((total, line) => total + line.quantity, 0),
    subtotal: roundMoney(
      cart.reduce(
        (total, line) => total + line.quantity * Number(line.sellingPrice),
        0,
      ),
    ),
  };
}

export function normalizeQuantity(quantity: number) {
  if (!Number.isFinite(quantity)) {
    return 0;
  }
  return Math.trunc(quantity);
}

export function shouldClearCustomerCart(input: {
  status: "loading" | "authenticated" | "unauthenticated";
  role: UserRole | null | undefined;
}) {
  return input.status !== "authenticated" || input.role !== "CUSTOMER";
}

export function formatCustomerCartNavLabel(totalQuantity: number) {
  if (totalQuantity === 0) {
    return "Cart";
  }
  return `Cart (${totalQuantity} ${totalQuantity === 1 ? "item" : "items"})`;
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
