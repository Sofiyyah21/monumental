import type { ReactNode } from "react";
import type { AppRoute } from "../routing/routes";
import {
  getDefaultRouteForUser,
  getVisibleNavigation,
} from "../routing/routes";
import { navigate } from "../routing/useBrowserRoute";
import { useAuth } from "../auth/useAuth";
import { Logo } from "./Logo";

export function AppShell({
  activeRoute,
  children,
}: {
  activeRoute: AppRoute;
  children: ReactNode;
}) {
  const auth = useAuth();
  const navigation = getVisibleNavigation(auth.user);

  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="Primary navigation">
        <button
          className="brand-button"
          type="button"
          onClick={() =>
            auth.user && navigate(getDefaultRouteForUser(auth.user))
          }
        >
          <Logo />
        </button>
        <nav className="nav-list">
          {navigation.map((route) => (
            <button
              key={route.path}
              type="button"
              className={
                route.path === activeRoute.path ? "nav-item active" : "nav-item"
              }
              onClick={() => navigate(route.path)}
              aria-current={
                route.path === activeRoute.path ? "page" : undefined
              }
            >
              {route.navLabel}
            </button>
          ))}
        </nav>
      </aside>

      <div className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">Monumental Details</p>
            <h1>{activeRoute.title}</h1>
          </div>
          <div className="account-area">
            <div className="account-copy">
              <strong>{auth.user?.name}</strong>
              <span>{auth.user?.role}</span>
            </div>
            <button
              className="button button--quiet"
              type="button"
              onClick={() => void auth.logout()}
            >
              Logout
            </button>
          </div>
        </header>

        <main className="content" tabIndex={-1}>
          {children}
        </main>
      </div>
    </div>
  );
}
