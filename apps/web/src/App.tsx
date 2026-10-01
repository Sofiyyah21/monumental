import { useEffect, useState } from "react";
import { AuthProvider } from "./auth/AuthContext";
import { useAuth } from "./auth/useAuth";
import { AppShell } from "./components/AppShell";
import { LoadingState } from "./components/Feedback";
import { CartPage } from "./customer/CartPage";
import { CustomerCartProvider } from "./customer/CartContext";
import {
  CustomerOrderDetailPage,
  CustomerOrdersPage,
} from "./customer/CustomerOrdersPage";
import { ShopPage } from "./customer/ShopPage";
import { DashboardPage } from "./dashboard/DashboardPage";
import { InventoryPage } from "./inventory/InventoryPage";
import {
  ManagementOrderDetailPage,
  ManagementOrdersPage,
} from "./orders/ManagementOrdersPage";
import { FoundationPage } from "./pages/FoundationPage";
import { ForbiddenPage } from "./pages/ForbiddenPage";
import { LoginPage } from "./pages/LoginPage";
import { SignUpPage } from "./pages/SignUpPage";
import { ProductPage } from "./products/ProductPage";
import {
  canAccessRoute,
  findRoute,
  getDefaultRouteForUser,
  routes,
} from "./routing/routes";
import { SaleDetailPage, SalesHistoryPage } from "./sales/SalesHistoryPage";
import { SalesPage } from "./sales/SalesPage";
import { useBrowserRoute } from "./routing/useBrowserRoute";
import "./App.css";

function AppRoutes() {
  const auth = useAuth();
  const { pathname, navigate, replace } = useBrowserRoute();
  const [registrationNotice, setRegistrationNotice] = useState<string | null>(
    null,
  );
  const activeRoute = findRoute(pathname);

  useEffect(() => {
    if (auth.status === "loading") {
      return;
    }

    const isPublicAuthRoute =
      pathname === routes.login.path || pathname === routes.signup.path;

    if (auth.status === "unauthenticated" && !isPublicAuthRoute) {
      replace(routes.login.path);
      return;
    }

    if (auth.user && (pathname === "/" || isPublicAuthRoute)) {
      replace(getDefaultRouteForUser(auth.user));
    }
  }, [auth.status, auth.user, pathname, replace]);

  if (auth.status === "loading") {
    return <LoadingState message="Checking your session" />;
  }

  if (auth.status === "unauthenticated") {
    if (pathname === routes.signup.path) {
      return (
        <SignUpPage
          onRegistered={() => {
            setRegistrationNotice(
              "Account created successfully. Please sign in.",
            );
            replace(routes.login.path);
          }}
        />
      );
    }

    return (
      <LoginPage
        successMessage={registrationNotice}
        onAuthenticated={(user) => {
          setRegistrationNotice(null);
          replace(getDefaultRouteForUser(user));
        }}
      />
    );
  }

  if (!auth.user) {
    return <LoadingState message="Preparing workspace" />;
  }

  if (
    !activeRoute ||
    activeRoute.path === routes.login.path ||
    activeRoute.path === routes.signup.path
  ) {
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

  if (
    activeRoute.path === routes.admin.path ||
    activeRoute.path === routes.reports.path
  ) {
    return (
      <AppShell activeRoute={activeRoute}>
        <DashboardPage />
      </AppShell>
    );
  }

  if (activeRoute.path === routes.products.path) {
    return (
      <AppShell activeRoute={activeRoute}>
        <ProductPage />
      </AppShell>
    );
  }

  if (activeRoute.path === routes.inventory.path) {
    return (
      <AppShell activeRoute={activeRoute}>
        <InventoryPage />
      </AppShell>
    );
  }

  if (activeRoute.path === routes.sales.path) {
    return (
      <AppShell activeRoute={activeRoute}>
        <SalesPage onOpenSale={(id) => navigate(`/sales/${id}`)} />
      </AppShell>
    );
  }

  if (activeRoute.path === routes.salesHistory.path) {
    return (
      <AppShell activeRoute={activeRoute}>
        <SalesHistoryPage onOpenSale={(id) => navigate(`/sales/${id}`)} />
      </AppShell>
    );
  }

  if (activeRoute.path === routes.saleDetail.path) {
    const saleId = decodeURIComponent(pathname.replace("/sales/", ""));
    return (
      <AppShell activeRoute={activeRoute}>
        <SaleDetailPage
          onBackToHistory={() => navigate(routes.salesHistory.path)}
          onNewSale={() => navigate(routes.sales.path)}
          saleId={saleId}
        />
      </AppShell>
    );
  }

  if (activeRoute.path === routes.shop.path) {
    return (
      <AppShell activeRoute={activeRoute}>
        <ShopPage />
      </AppShell>
    );
  }

  if (activeRoute.path === routes.cart.path) {
    return (
      <AppShell activeRoute={activeRoute}>
        <CartPage />
      </AppShell>
    );
  }

  if (activeRoute.path === routes.orders.path) {
    return (
      <AppShell activeRoute={activeRoute}>
        <CustomerOrdersPage onOpenOrder={(id) => navigate(`/orders/${id}`)} />
      </AppShell>
    );
  }

  if (activeRoute.path === routes.orderDetail.path) {
    const orderId = decodeURIComponent(pathname.replace("/orders/", ""));
    return (
      <AppShell activeRoute={activeRoute}>
        <CustomerOrderDetailPage
          onBackToOrders={() => navigate(routes.orders.path)}
          onContinueShopping={() => navigate(routes.shop.path)}
          orderId={orderId}
        />
      </AppShell>
    );
  }

  if (activeRoute.path === routes.manageOrders.path) {
    return (
      <AppShell activeRoute={activeRoute}>
        <ManagementOrdersPage
          onOpenOrder={(id) => navigate(`/orders/manage/${id}`)}
        />
      </AppShell>
    );
  }

  if (activeRoute.path === routes.manageOrderDetail.path) {
    const orderId = decodeURIComponent(pathname.replace("/orders/manage/", ""));
    return (
      <AppShell activeRoute={activeRoute}>
        <ManagementOrderDetailPage
          onBackToOrders={() => navigate(routes.manageOrders.path)}
          orderId={orderId}
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
      <CustomerCartProvider>
        <AppRoutes />
      </CustomerCartProvider>
    </AuthProvider>
  );
}

export default App;
