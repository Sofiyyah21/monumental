import { describe, expect, it, vi } from "vitest";
import { ApiClient, ApiError } from "./client";
import type { AuthResponse } from "./types";
import { MemoryTokenStorage } from "../auth/token-storage";

const user = {
  id: "user_1",
  email: "admin@monumental.test",
  name: "Admin User",
  role: "ADMIN",
} as const;

const authResponse: AuthResponse = {
  user,
  accessToken: "access-token",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("ApiClient", () => {
  it("logs in and stores only the access token in the configured storage", async () => {
    const storage = new MemoryTokenStorage();
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ success: true, data: authResponse }),
    );
    const client = new ApiClient({
      baseUrl: "https://api.test/api/v1",
      tokenStorage: storage,
      fetchImpl,
    });

    const result = await client.login("admin@monumental.test", "password");

    expect(result.user.role).toBe("ADMIN");
    expect(storage.read()).toEqual({
      accessToken: "access-token",
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://api.test/api/v1/auth/login",
      expect.objectContaining({
        method: "POST",
      }),
    );
  });

  it("surfaces login failures as API errors without storing tokens", async () => {
    const storage = new MemoryTokenStorage();
    const fetchImpl = vi.fn(async () =>
      jsonResponse(
        {
          success: false,
          error: {
            code: "INVALID_CREDENTIALS",
            message: "Invalid email or password",
          },
        },
        401,
      ),
    );
    const client = new ApiClient({ tokenStorage: storage, fetchImpl });

    await expect(client.login("wrong@test", "bad")).rejects.toBeInstanceOf(
      ApiError,
    );
    expect(storage.read()).toBeNull();
  });

  it("refreshes a session and retries the original request after a 401", async () => {
    const storage = new MemoryTokenStorage();
    storage.write({
      accessToken: "expired-access",
    });
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(
          {
            success: false,
            error: { code: "INVALID_ACCESS_TOKEN", message: "Expired" },
          },
          401,
        ),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          success: true,
          data: {
            ...authResponse,
            accessToken: "new-access",
          },
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ success: true, data: user }));
    const client = new ApiClient({
      baseUrl: "/api/v1",
      tokenStorage: storage,
      fetchImpl,
    });

    const currentUser = await client.getCurrentUser();

    expect(currentUser).toEqual(user);
    expect(storage.read()).toEqual({
      accessToken: "new-access",
    });
    expect(fetchImpl.mock.calls[1]?.[0]).toBe("/api/v1/auth/refresh");
    expect(fetchImpl.mock.calls[1]?.[1]).toEqual(
      expect.objectContaining({
        credentials: "include",
        method: "POST",
      }),
    );
    expect(fetchImpl.mock.calls[1]?.[1]).not.toHaveProperty("body");
    const retryHeaders = fetchImpl.mock.calls[2]?.[1]?.headers as Headers;
    expect(retryHeaders.get("Authorization")).toBe("Bearer new-access");
  });

  it("uses a single in-flight refresh request for simultaneous refreshes", async () => {
    const storage = new MemoryTokenStorage();
    const fetchImpl = vi.fn(
      async () =>
        new Promise<Response>((resolve) => {
          setTimeout(() => {
            resolve(jsonResponse({ success: true, data: authResponse }));
          }, 0);
        }),
    );
    const client = new ApiClient({ tokenStorage: storage, fetchImpl });

    const [first, second] = await Promise.all([
      client.refreshSession(),
      client.refreshSession(),
    ]);

    expect(first).toEqual(authResponse);
    expect(second).toEqual(authResponse);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(storage.read()).toEqual({ accessToken: "access-token" });
  });

  it("clears session after a failed refresh retry", async () => {
    const storage = new MemoryTokenStorage();
    storage.write({ accessToken: "expired-access" });
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(
          {
            success: false,
            error: { code: "INVALID_ACCESS_TOKEN", message: "Expired" },
          },
          401,
        ),
      )
      .mockResolvedValueOnce(
        jsonResponse(
          {
            success: false,
            error: { code: "INVALID_REFRESH_TOKEN", message: "Invalid" },
          },
          401,
        ),
      );
    const client = new ApiClient({ tokenStorage: storage, fetchImpl });

    await expect(client.getCurrentUser()).rejects.toBeInstanceOf(ApiError);

    expect(storage.read()).toBeNull();
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("revokes the refresh cookie on logout and clears the frontend session", async () => {
    const storage = new MemoryTokenStorage();
    storage.write({ accessToken: "access" });
    const fetchImpl = vi.fn<typeof fetch>(
      async () => new Response(null, { status: 204 }),
    );
    const client = new ApiClient({ tokenStorage: storage, fetchImpl });

    await client.logout();

    const logoutInit = fetchImpl.mock.calls[0]?.[1] as RequestInit | undefined;
    expect(storage.read()).toBeNull();
    expect(fetchImpl).toHaveBeenCalledWith(
      "/api/v1/auth/logout",
      expect.objectContaining({
        method: "POST",
        credentials: "include",
      }),
    );
    expect(logoutInit).not.toHaveProperty("body");
  });

  it("requests reporting period summaries and supporting dashboard data", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) =>
      jsonResponse({
        success: true,
        data: String(input).includes("best-sellers")
          ? {
              period: "today",
              range: { start: "", end: "" },
              rankingMetric: "quantitySold",
              products: [],
            }
          : String(input).includes("low-stock")
            ? []
            : String(input).includes("sales?")
              ? []
              : {
                  period: "today",
                  range: {
                    start: "2026-09-14T23:00:00.000Z",
                    end: "2026-09-15T23:00:00.000Z",
                  },
                  salesCount: 0,
                  unitsSold: "0.000",
                  revenue: "0.00",
                  cogs: "0.00",
                  grossProfit: "0.00",
                  discounts: "0.00",
                  averageSaleValue: "0.00",
                },
      }),
    );
    const client = new ApiClient({
      baseUrl: "https://api.test/api/v1",
      tokenStorage: new MemoryTokenStorage(),
      fetchImpl,
    });

    await client.getSalesSummary("today");
    await client.getSalesSummary("week");
    await client.getSalesSummary("month");
    await client.getSalesSummary("year");
    await client.getSalesSummary("custom", {
      from: "2026-09-01",
      to: "2026-09-15",
    });
    await client.getBestSellers({
      from: "2026-09-01T00:00:00.000Z",
      to: "2026-09-15T23:59:59.999Z",
      limit: 5,
    });
    await client.getLowStock();
    await client.getRecentSales({
      from: "2026-09-01T00:00:00.000Z",
      to: "2026-09-15T23:59:59.999Z",
      limit: 5,
    });

    const urls = fetchImpl.mock.calls.map((call) => call[0]);
    expect(urls).toEqual([
      "https://api.test/api/v1/reports/today",
      "https://api.test/api/v1/reports/week",
      "https://api.test/api/v1/reports/month",
      "https://api.test/api/v1/reports/year",
      "https://api.test/api/v1/reports/sales?from=2026-09-01&to=2026-09-15",
      "https://api.test/api/v1/reports/best-sellers?from=2026-09-01T00%3A00%3A00.000Z&to=2026-09-15T23%3A59%3A59.999Z&limit=5",
      "https://api.test/api/v1/reports/low-stock",
      "https://api.test/api/v1/sales?from=2026-09-01T00%3A00%3A00.000Z&to=2026-09-15T23%3A59%3A59.999Z&limit=5&status=COMPLETED",
    ]);
  });

  it("uses the product management API contract", async () => {
    const product = {
      id: "product_1",
      name: "Vegetable Oil",
      sku: "OIL-1",
      category: "VEGETABLE_OIL",
      unit: "LITER",
      costPrice: "800.00",
      sellingPrice: "1000.00",
      currentStock: "4.000",
      reorderLevel: "2.000",
      active: true,
      createdAt: "2026-09-15T09:00:00.000Z",
      updatedAt: "2026-09-15T09:00:00.000Z",
    };
    const requests: Array<[RequestInfo | URL, RequestInit | undefined]> = [];
    const fetchImpl = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        requests.push([input, init]);
        return jsonResponse({ success: true, data: product });
      },
    );
    const client = new ApiClient({
      baseUrl: "https://api.test/api/v1",
      tokenStorage: new MemoryTokenStorage(),
      fetchImpl,
    });

    await client.listProducts({
      search: "oil",
      category: "VEGETABLE_OIL",
      unit: "LITER",
      active: false,
    });
    await client.createProduct({
      name: "Vegetable Oil",
      sku: "oil-1",
      category: "VEGETABLE_OIL",
      unit: "LITER",
      costPrice: 800,
      sellingPrice: 1000,
      reorderLevel: 2,
    });
    await client.updateProduct("product_1", { sellingPrice: 1100 });
    await client.deactivateProduct("product_1");

    expect(requests[0]?.[0]).toBe(
      "https://api.test/api/v1/products?search=oil&category=VEGETABLE_OIL&unit=LITER&active=false",
    );
    expect(requests[1]?.[0]).toBe("https://api.test/api/v1/products");
    expect(requests[1]?.[1]).toEqual(
      expect.objectContaining({
        method: "POST",
      }),
    );
    expect(requests[2]?.[0]).toBe("https://api.test/api/v1/products/product_1");
    expect(requests[2]?.[1]).toEqual(
      expect.objectContaining({
        method: "PATCH",
      }),
    );
    expect(requests[3]?.[0]).toBe(
      "https://api.test/api/v1/products/product_1/deactivate",
    );
  });

  it("uses the existing active product API for customer catalog lookup", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({
        success: true,
        data: [
          {
            id: "product_1",
            name: "Monumental Drinks Pack",
            sku: "DRINK-001",
            category: "DRINKS",
            unit: "PACK",
            sellingPrice: "3500.00",
            availability: "AVAILABLE",
          },
        ],
      }),
    );
    const client = new ApiClient({
      baseUrl: "https://api.test/api/v1",
      tokenStorage: new MemoryTokenStorage(),
      fetchImpl,
    });

    const result = await client.listCustomerCatalogProducts({
      search: "drink",
      category: "DRINKS",
      unit: "PACK",
    });

    expect(result[0]?.availability).toBe("AVAILABLE");
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://api.test/api/v1/products?search=drink&category=DRINKS&unit=PACK&active=true",
      expect.objectContaining({
        credentials: "include",
      }),
    );
  });

  it("uses the inventory API contract", async () => {
    const requests: Array<[RequestInfo | URL, RequestInit | undefined]> = [];
    const fetchImpl = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        requests.push([input, init]);
        return jsonResponse({ success: true, data: [] });
      },
    );
    const client = new ApiClient({
      baseUrl: "https://api.test/api/v1",
      tokenStorage: new MemoryTokenStorage(),
      fetchImpl,
    });

    await client.listInventory({ active: true, lowStock: false });
    await client.listLowStockInventory();
    await client.getProductInventory("product_1");
    await client.listStockMovements({
      productId: "product_1",
      type: "RECEIVED",
      from: "2026-09-01T00:00:00.000Z",
      to: "2026-09-15T23:59:59.999Z",
      limit: 25,
    });
    await client.receiveStock({
      productId: "product_1",
      quantity: 5,
      unit: "PACK",
      unitCost: 100,
      reference: "INV-1",
      note: "Restock",
    });
    await client.adjustStock({
      productId: "product_1",
      quantityChange: -1,
      unit: "PACK",
      reason: "Count correction",
    });
    await client.returnStock({
      productId: "product_1",
      quantity: 1,
      unit: "PACK",
    });
    await client.recordDamage({
      productId: "product_1",
      quantity: 1,
      unit: "PACK",
      reason: "Damaged bottle",
    });

    expect(requests.map((request) => request[0])).toEqual([
      "https://api.test/api/v1/inventory?active=true&lowStock=false",
      "https://api.test/api/v1/inventory/low-stock",
      "https://api.test/api/v1/inventory/products/product_1",
      "https://api.test/api/v1/inventory/movements?productId=product_1&type=RECEIVED&from=2026-09-01T00%3A00%3A00.000Z&to=2026-09-15T23%3A59%3A59.999Z&limit=25",
      "https://api.test/api/v1/inventory/receive",
      "https://api.test/api/v1/inventory/adjust",
      "https://api.test/api/v1/inventory/returns",
      "https://api.test/api/v1/inventory/damage",
    ]);
    expect(requests[4]?.[1]).toEqual(
      expect.objectContaining({ method: "POST" }),
    );
    expect(requests[5]?.[1]).toEqual(
      expect.objectContaining({ method: "POST" }),
    );
    expect(requests[6]?.[1]).toEqual(
      expect.objectContaining({ method: "POST" }),
    );
    expect(requests[7]?.[1]).toEqual(
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("uses the sales API contract", async () => {
    const sale = {
      id: "sale_1",
      reference: "MD-20260915-00001",
      sellerId: "user_1",
      customerId: null,
      status: "COMPLETED",
      paymentMethod: "CASH",
      paymentStatus: "PAID",
      paymentReference: null,
      subtotal: "500.00",
      discountAmount: "0.00",
      totalAmount: "500.00",
      totalCost: "300.00",
      grossProfit: "200.00",
      soldAt: "2026-09-15T10:00:00.000Z",
      createdAt: "2026-09-15T10:00:00.000Z",
      updatedAt: "2026-09-15T10:00:00.000Z",
      items: [],
    };
    const requests: Array<[RequestInfo | URL, RequestInit | undefined]> = [];
    const fetchImpl = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        requests.push([input, init]);
        return jsonResponse({ success: true, data: sale });
      },
    );
    const client = new ApiClient({
      baseUrl: "https://api.test/api/v1",
      tokenStorage: new MemoryTokenStorage(),
      fetchImpl,
    });

    await client.listSales({
      status: "COMPLETED",
      paymentStatus: "PAID",
      limit: 10,
    });
    await client.getSale("sale_1");
    await client.createSale({
      paymentMethod: "CASH",
      paymentStatus: "PAID",
      discountAmount: 0,
      items: [{ productId: "product_1", quantity: 2 }],
    });
    await client.voidSale("sale_1", { reason: "Wrong order" });

    expect(requests[0]?.[0]).toBe(
      "https://api.test/api/v1/sales?status=COMPLETED&paymentStatus=PAID&limit=10",
    );
    expect(requests[1]?.[0]).toBe("https://api.test/api/v1/sales/sale_1");
    expect(requests[2]?.[0]).toBe("https://api.test/api/v1/sales");
    expect(requests[2]?.[1]).toEqual(
      expect.objectContaining({ method: "POST" }),
    );
    expect(requests[3]?.[0]).toBe("https://api.test/api/v1/sales/sale_1/void");
    expect(requests[3]?.[1]).toEqual(
      expect.objectContaining({
        body: JSON.stringify({ reason: "Wrong order" }),
        method: "POST",
      }),
    );
  });
});
