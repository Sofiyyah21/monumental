import { createContext } from "react";
import type { CurrentUser, Permission, UserRole } from "../api/types";

export type AuthStatus = "loading" | "authenticated" | "unauthenticated";

export type AuthContextValue = {
  status: AuthStatus;
  user: CurrentUser | null;
  role: UserRole | null;
  permissions: Permission[];
  error: string | null;
  login(email: string, password: string): Promise<void>;
  logout(): Promise<void>;
  refreshUser(): Promise<void>;
  hasPermission(permission: Permission): boolean;
};

export const AuthContext = createContext<AuthContextValue | undefined>(
  undefined,
);
