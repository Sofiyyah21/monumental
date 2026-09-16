import { describe, expect, it } from "vitest";
import type { CurrentUser, UserRole } from "../api/types";
import {
  canAccessRoute,
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
      "Reports",
    ]);
  });

  it("shows manager management areas without admin-only access", () => {
    const manager = user("MANAGER");
    const labels = getVisibleNavigation(manager).map((route) => route.navLabel);

    expect(labels).toEqual(["Products", "Inventory", "Sales", "Reports"]);
    expect(canAccessRoute(manager, routes.reports)).toBe(true);
    expect(canAccessRoute(manager, routes.admin)).toBe(false);
  });

  it("shows staff operational areas only", () => {
    const staff = user("STAFF");
    const labels = getVisibleNavigation(staff).map((route) => route.navLabel);

    expect(labels).toEqual(["Products", "Inventory", "Sales"]);
    expect(canAccessRoute(staff, routes.reports)).toBe(false);
    expect(canAccessRoute(staff, routes.admin)).toBe(false);
  });

  it("keeps customers in the customer-facing area", () => {
    const customer = user("CUSTOMER");
    const labels = getVisibleNavigation(customer).map(
      (route) => route.navLabel,
    );

    expect(labels).toEqual(["Customer"]);
    expect(canAccessRoute(customer, routes.inventory)).toBe(false);
    expect(canAccessRoute(customer, routes.reports)).toBe(false);
    expect(canAccessRoute(customer, routes.admin)).toBe(false);
    expect(getDefaultRouteForUser(customer)).toBe("/customer");
  });

  it("chooses role-appropriate landing routes", () => {
    expect(getDefaultRouteForUser(user("ADMIN"))).toBe("/admin");
    expect(getDefaultRouteForUser(user("MANAGER"))).toBe("/reports");
    expect(getDefaultRouteForUser(user("STAFF"))).toBe("/sales");
  });
});
