import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { ApiClient, apiClient as defaultApiClient } from "../api/client";
import type { CurrentUser } from "../api/types";
import { getRolePermissions, hasPermission } from "./permissions";
import {
  AuthContext,
  type AuthContextValue,
  type AuthStatus,
} from "./auth-context";

export function AuthProvider({
  children,
  client = defaultApiClient,
}: {
  children: ReactNode;
  client?: ApiClient;
}) {
  const [status, setStatus] = useState<AuthStatus>(() =>
    client.getStoredTokens() ? "loading" : "unauthenticated",
  );
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [error, setError] = useState<string | null>(null);

  const setAuthenticatedUser = useCallback((currentUser: CurrentUser) => {
    setUser(currentUser);
    setStatus("authenticated");
    setError(null);
  }, []);

  const clearAuthState = useCallback(() => {
    setUser(null);
    setStatus("unauthenticated");
  }, []);

  const refreshUser = useCallback(async () => {
    setStatus("loading");
    try {
      const currentUser = await client.getCurrentUser();
      setAuthenticatedUser(currentUser);
    } catch {
      try {
        const auth = await client.refreshSession();
        setAuthenticatedUser(auth.user);
      } catch {
        client.clearSession();
        clearAuthState();
      }
    }
  }, [clearAuthState, client, setAuthenticatedUser]);

  useEffect(() => {
    if (!client.getStoredTokens()) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void refreshUser();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [client, refreshUser]);

  const login = useCallback(
    async (email: string, password: string) => {
      setStatus("loading");
      setError(null);
      try {
        const auth = await client.login(email, password);
        setAuthenticatedUser(auth.user);
      } catch (loginError) {
        clearAuthState();
        setError(
          loginError instanceof Error
            ? loginError.message
            : "Unable to sign in",
        );
        throw loginError;
      }
    },
    [clearAuthState, client, setAuthenticatedUser],
  );

  const logout = useCallback(async () => {
    await client.logout();
    clearAuthState();
  }, [clearAuthState, client]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      role: user?.role ?? null,
      permissions: user ? getRolePermissions(user.role) : [],
      error,
      login,
      logout,
      refreshUser,
      hasPermission: (permission) => hasPermission(user, permission),
    }),
    [error, login, logout, refreshUser, status, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
