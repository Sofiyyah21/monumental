import { useEffect } from "react";
import { AuthProvider } from "./auth/AuthContext";
import { useAuth } from "./auth/useAuth";
import { AppShell } from "./components/AppShell";
import { LoadingState } from "./components/Feedback";
import { FoundationPage } from "./pages/FoundationPage";
import { ForbiddenPage } from "./pages/ForbiddenPage";
import { LoginPage } from "./pages/LoginPage";
import {
  canAccessRoute,
  findRoute,
  getDefaultRouteForUser,
  routes,
} from "./routing/routes";
import { useBrowserRoute } from "./routing/useBrowserRoute";
import "./App.css";

function AppRoutes() {
  const auth = useAuth();
  const { pathname, replace } = useBrowserRoute();
  const activeRoute = findRoute(pathname);

  useEffect(() => {
    if (auth.status === "loading") {
      return;
    }

    if (auth.status === "unauthenticated" && pathname !== routes.login.path) {
      replace(routes.login.path);
      return;
    }

    if (auth.user && (pathname === "/" || pathname === routes.login.path)) {
      replace(getDefaultRouteForUser(auth.user));
    }
  }, [auth.status, auth.user, pathname, replace]);

  if (auth.status === "loading") {
    return <LoadingState message="Checking your session" />;
  }

  if (auth.status === "unauthenticated") {
    return (
      <LoginPage
        onAuthenticated={() => {
          if (auth.user) {
            replace(getDefaultRouteForUser(auth.user));
          }
        }}
      />
    );
  }

  if (!auth.user) {
    return <LoadingState message="Preparing workspace" />;
  }

  if (!activeRoute || activeRoute.path === routes.login.path) {
    return <LoadingState message="Opening workspace" />;
  }

  if (!canAccessRoute(auth.user, activeRoute)) {
    return (
      <AppShell activeRoute={routes.forbidden}>
        <ForbiddenPage
          onGoHome={() => replace(getDefaultRouteForUser(auth.user!))}
        />
      </AppShell>
    );
  }

  if (activeRoute.path === routes.forbidden.path) {
    return (
      <AppShell activeRoute={activeRoute}>
        <ForbiddenPage
          onGoHome={() => replace(getDefaultRouteForUser(auth.user!))}
        />
      </AppShell>
    );
  }

  return (
    <AppShell activeRoute={activeRoute}>
      <FoundationPage route={activeRoute} />
    </AppShell>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}

export default App;
