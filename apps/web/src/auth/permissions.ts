import type { CurrentUser, Permission, UserRole } from "../api/types";

export const permissions = {
  MANAGE_USERS: "manage:users",
  READ_PRODUCTS: "read:products",
  MANAGE_PRODUCTS: "manage:products",
  READ_INVENTORY: "read:inventory",
  MANAGE_INVENTORY: "manage:inventory",
  READ_SALES: "read:sales",
  CREATE_SALES: "create:sales",
  VOID_SALES: "void:sales",
  READ_ORDERS: "read:orders",
  MANAGE_ORDERS: "manage:orders",
  READ_REPORTS: "read:reports",
  READ_ADMIN_DASHBOARD: "read:admin-dashboard",
} as const satisfies Record<string, Permission>;

const rolePermissions: Record<UserRole, ReadonlySet<Permission>> = {
  ADMIN: new Set(Object.values(permissions)),
  MANAGER: new Set([
    permissions.READ_PRODUCTS,
    permissions.MANAGE_PRODUCTS,
    permissions.READ_INVENTORY,
    permissions.MANAGE_INVENTORY,
    permissions.READ_SALES,
    permissions.CREATE_SALES,
    permissions.VOID_SALES,
    permissions.READ_ORDERS,
    permissions.MANAGE_ORDERS,
    permissions.READ_REPORTS,
  ]),
  STAFF: new Set([
    permissions.READ_PRODUCTS,
    permissions.READ_INVENTORY,
    permissions.READ_SALES,
    permissions.CREATE_SALES,
  ]),
  CUSTOMER: new Set([]),
};

export function getRolePermissions(role: UserRole) {
  return [...rolePermissions[role]];
}

export function hasPermission(
  user: CurrentUser | null | undefined,
  permission: Permission,
) {
  return (
    user?.role === "ADMIN" ||
    Boolean(user && rolePermissions[user.role].has(permission))
  );
}
