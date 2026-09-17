import { UserRole } from "@prisma/client";

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
  READ_REPORTS: "read:reports",
  READ_ADMIN_DASHBOARD: "read:admin-dashboard",
} as const;

export type Permission = (typeof permissions)[keyof typeof permissions];

const rolePermissions: Record<UserRole, ReadonlySet<Permission>> = {
  [UserRole.ADMIN]: new Set(Object.values(permissions)),
  [UserRole.MANAGER]: new Set([
    permissions.READ_PRODUCTS,
    permissions.MANAGE_PRODUCTS,
    permissions.READ_INVENTORY,
    permissions.MANAGE_INVENTORY,
    permissions.READ_SALES,
    permissions.CREATE_SALES,
    permissions.VOID_SALES,
    permissions.READ_ORDERS,
    permissions.READ_REPORTS,
  ]),
  [UserRole.STAFF]: new Set([
    permissions.READ_PRODUCTS,
    permissions.READ_INVENTORY,
    permissions.READ_SALES,
    permissions.CREATE_SALES,
  ]),
  [UserRole.CUSTOMER]: new Set([]),
};

export function roleHasPermission(role: UserRole, permission: Permission) {
  return role === UserRole.ADMIN || rolePermissions[role].has(permission);
}
