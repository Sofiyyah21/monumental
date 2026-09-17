import { describe, expect, it } from "vitest";
import type { CurrentUser, UserRole } from "../api/types";
import { hasPermission, permissions } from "../auth/permissions";
import { formatCustomerCartNavLabel } from "../customer/cart-utils";
import {
  canAccessRoute,
  findRoute,
  getDefaultRouteForUser,
  getVisibleNavigation,
  routes,
} from "./routes";

function user(role: UserRole): CurrentUser {
  return {
    id: `${role.toLowerCase()}_1`,
    email: `${role.toLowerCase()}@monumental.test`,
    name: `${role} User`,
    role,
  };
}

describe("route authorization", () => {
  it("requires authentication for protected application routes", () => {
    expect(canAccessRoute(null, routes.login)).toBe(true);
    expect(canAccessRoute(null, routes.sales)).toBe(false);
    expect(canAccessRoute(null, routes.admin)).toBe(false);
  });

  it("shows admin the broadest navigation", () => {
    const labels = getVisibleNavigation(user("ADMIN")).map(
      (route) => route.navLabel,
    );

    expect(labels).toEqual([
      "Admin",
      "Products",
      "Inventory",
      "Sales",
      "Sales History",
      "Reports",
    ]);
  });

  it("shows manager management areas without admin-only access", () => {
    const manager = user("MANAGER");
    const labels = getVisibleNavigation(manager).map((route) => route.navLabel);

    expect(labels).toEqual([
      "Products",
      "Inventory",
      "Sales",
      "Sales History",
      "Reports",
    ]);
    expect(canAccessRoute(manager, routes.products)).toBe(true);
    expect(canAccessRoute(manager, routes.inventory)).toBe(true);
    expect(canAccessRoute(manager, routes.reports)).toBe(true);
    expect(canAccessRoute(manager, routes.admin)).toBe(false);
    expect(hasPermission(manager, permissions.MANAGE_PRODUCTS)).toBe(true);
    expect(hasPermission(manager, permissions.MANAGE_INVENTORY)).toBe(true);
    expect(hasPermission(manager, permissions.CREATE_SALES)).toBe(true);
  });

  it("shows staff operational areas only", () => {
    const staff = user("STAFF");
    const labels = getVisibleNavigation(staff).map((route) => route.navLabel);

    expect(labels).toEqual(["Products", "Inventory", "Sales", "Sales History"]);
    expect(canAccessRoute(staff, routes.products)).toBe(true);
    expect(canAccessRoute(staff, routes.inventory)).toBe(true);
    expect(canAccessRoute(staff, routes.reports)).toBe(false);
    expect(canAccessRoute(staff, routes.admin)).toBe(false);
    expect(hasPermission(staff, permissions.READ_PRODUCTS)).toBe(true);
    expect(hasPermission(staff, permissions.MANAGE_PRODUCTS)).toBe(false);
    expect(hasPermission(staff, permissions.READ_INVENTORY)).toBe(true);
    expect(hasPermission(staff, permissions.MANAGE_INVENTORY)).toBe(false);
    expect(hasPermission(staff, permissions.CREATE_SALES)).toBe(true);
  });

  it("keeps customers in the customer-facing shop area", () => {
    const customer = user("CUSTOMER");
    const labels = getVisibleNavigation(customer).map(
      (route) => route.navLabel,
    );

    expect(labels).toEqual(["Shop", "Cart"]);
    expect(canAccessRoute(customer, routes.shop)).toBe(true);
    expect(canAccessRoute(customer, routes.cart)).toBe(true);
    expect(canAccessRoute(customer, routes.products)).toBe(false);
    expect(canAccessRoute(customer, routes.inventory)).toBe(false);
    expect(canAccessRoute(customer, routes.sales)).toBe(false);
    expect(canAccessRoute(customer, routes.salesHistory)).toBe(false);
    expect(canAccessRoute(customer, routes.saleDetail)).toBe(false);
    expect(canAccessRoute(customer, routes.reports)).toBe(false);
    expect(canAccessRoute(customer, routes.admin)).toBe(false);
    expect(getDefaultRouteForUser(customer)).toBe("/shop");
  });

  it("keeps the customer shop route separate from management roles", () => {
    expect(canAccessRoute(user("ADMIN"), routes.shop)).toBe(false);
    expect(canAccessRoute(user("MANAGER"), routes.shop)).toBe(false);
    expect(canAccessRoute(user("STAFF"), routes.shop)).toBe(false);
    expect(canAccessRoute(user("ADMIN"), routes.cart)).toBe(false);
    expect(canAccessRoute(user("MANAGER"), routes.cart)).toBe(false);
    expect(canAccessRoute(user("STAFF"), routes.cart)).toBe(false);
    expect(canAccessRoute(user("CUSTOMER"), routes.customer)).toBe(true);
  });

  it("labels customer cart navigation by total quantity", () => {
    expect(formatCustomerCartNavLabel(0)).toBe("Cart");
    expect(formatCustomerCartNavLabel(1)).toBe("Cart (1 item)");
    expect(formatCustomerCartNavLabel(3)).toBe("Cart (3 items)");
  });

  it("chooses role-appropriate landing routes", () => {
    expect(getDefaultRouteForUser(user("ADMIN"))).toBe("/admin");
    expect(getDefaultRouteForUser(user("MANAGER"))).toBe("/reports");
    expect(getDefaultRouteForUser(user("STAFF"))).toBe("/sales");
  });

  it("recognizes sales history and dynamic sale detail routes", () => {
    expect(findRoute("/sales/history")).toBe(routes.salesHistory);
    expect(findRoute("/sales/sale_1")).toBe(routes.saleDetail);
  });
});
