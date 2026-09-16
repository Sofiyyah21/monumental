import type { CurrentUser, Permission, UserRole } from "../api/types";
import { hasPermission, permissions } from "../auth/permissions";

export type AppRoute = {
  path: string;
  title: string;
  description: string;
  navLabel?: string;
  requiresAuth: boolean;
  permission?: Permission;
  roles?: UserRole[];
};

type RouteKey =
  | "login"
  | "admin"
  | "products"
  | "inventory"
  | "sales"
  | "reports"
  | "customer"
  | "forbidden";

export const routes: Record<RouteKey, AppRoute> = {
  login: {
    path: "/login",
    title: "Sign in",
    description: "Access Monumental Details.",
    requiresAuth: false,
  },
  admin: {
    path: "/admin",
    title: "Admin dashboard",
    description: "Administrative overview foundation.",
    navLabel: "Admin",
    requiresAuth: true,
    permission: permissions.READ_ADMIN_DASHBOARD,
  },
  products: {
    path: "/products",
    title: "Products",
    description: "Product catalog workspace foundation.",
    navLabel: "Products",
    requiresAuth: true,
    permission: permissions.READ_PRODUCTS,
  },
  inventory: {
    path: "/inventory",
    title: "Inventory",
    description: "Stock visibility and inventory operations foundation.",
    navLabel: "Inventory",
    requiresAuth: true,
    permission: permissions.READ_INVENTORY,
  },
  sales: {
    path: "/sales",
    title: "Sales",
    description: "Point-of-sale operations foundation.",
    navLabel: "Sales",
    requiresAuth: true,
    permission: permissions.READ_SALES,
  },
  reports: {
    path: "/reports",
    title: "Reports",
    description: "Backend reporting access foundation.",
    navLabel: "Reports",
    requiresAuth: true,
    permission: permissions.READ_REPORTS,
  },
  customer: {
    path: "/customer",
    title: "Customer area",
    description: "Customer-facing account foundation.",
    navLabel: "Customer",
    requiresAuth: true,
    roles: ["CUSTOMER"],
  },
  forbidden: {
    path: "/forbidden",
    title: "Access restricted",
    description: "Your account does not have access to this area.",
    requiresAuth: true,
  },
};

export const appRoutes = Object.values(routes);
export const navigationRoutes = appRoutes.filter((route) => route.navLabel);

export function canAccessRoute(user: CurrentUser | null, route: AppRoute) {
  if (!route.requiresAuth) {
    return true;
  }
  if (!user) {
    return false;
  }
  if (route.roles && !route.roles.includes(user.role)) {
    return false;
  }
  if (route.permission && !hasPermission(user, route.permission)) {
    return false;
  }
  return true;
}

export function getVisibleNavigation(user: CurrentUser | null) {
  return navigationRoutes.filter((route) => canAccessRoute(user, route));
}

export function getDefaultRouteForUser(user: CurrentUser) {
  if (user.role === "CUSTOMER") {
    return routes.customer.path;
  }
  if (user.role === "ADMIN") {
    return routes.admin.path;
  }
  if (hasPermission(user, permissions.READ_REPORTS)) {
    return routes.reports.path;
  }
  if (hasPermission(user, permissions.READ_SALES)) {
    return routes.sales.path;
  }
  return routes.products.path;
}

export function findRoute(pathname: string) {
  return appRoutes.find((route) => route.path === pathname);
}
