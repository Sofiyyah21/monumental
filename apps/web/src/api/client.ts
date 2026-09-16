import { config } from "../config";
import type { TokenStorage } from "../auth/token-storage";
import { SessionTokenStorage } from "../auth/token-storage";
import type {
  ApiEnvelope,
  AuthResponse,
  BestSellersReport,
  LowStockReportItem,
  ReportPeriod,
  Sale,
  SalesSummaryReport,
} from "./types";
import type { CurrentUser } from "./types";

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, status: number, code = "API_ERROR") {
    super(message);
    this.status = status;
    this.code = code;
  }
}

type ApiClientOptions = {
  baseUrl?: string;
  tokenStorage?: TokenStorage;
  fetchImpl?: typeof fetch;
};

type RequestOptions = RequestInit & {
  retryOnUnauthorized?: boolean;
};

export class ApiClient {
  private readonly baseUrl: string;
  private readonly tokenStorage: TokenStorage;
  private readonly fetchImpl: typeof fetch;
  private accessToken: string | null = null;

  constructor(options: ApiClientOptions = {}) {
    this.baseUrl = (options.baseUrl ?? config.apiBaseUrl).replace(/\/$/, "");
    this.tokenStorage = options.tokenStorage ?? new SessionTokenStorage();
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.accessToken = this.tokenStorage.read()?.accessToken ?? null;
  }

  getStoredTokens() {
    return this.tokenStorage.read();
  }

  setSession(auth: AuthResponse) {
    this.accessToken = auth.accessToken;
    this.tokenStorage.write({
      accessToken: auth.accessToken,
      refreshToken: auth.refreshToken,
    });
  }

  clearSession() {
    this.accessToken = null;
    this.tokenStorage.clear();
  }

  async login(email: string, password: string) {
    const auth = await this.request<AuthResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
      retryOnUnauthorized: false,
    });
    this.setSession(auth);
    return auth;
  }

  async logout() {
    const refreshToken = this.tokenStorage.read()?.refreshToken;
    this.clearSession();

    if (!refreshToken) {
      return;
    }

    try {
      await this.request<void>("/auth/logout", {
        method: "POST",
        body: JSON.stringify({ refreshToken }),
        retryOnUnauthorized: false,
      });
    } catch {
      this.clearSession();
    }
  }

  async refreshSession() {
    const refreshToken = this.tokenStorage.read()?.refreshToken;
    if (!refreshToken) {
      throw new ApiError("No refresh token is available", 401, "AUTH_REQUIRED");
    }

    const auth = await this.request<AuthResponse>("/auth/refresh", {
      method: "POST",
      body: JSON.stringify({ refreshToken }),
      retryOnUnauthorized: false,
    });
    this.setSession(auth);
    return auth;
  }

  async getCurrentUser() {
    return this.request<CurrentUser>("/auth/me");
  }

  async getSalesSummary(
    period: ReportPeriod | "custom",
    filters: { from?: string; to?: string } = {},
  ) {
    const query = new URLSearchParams();
    if (filters.from) {
      query.set("from", filters.from);
    }
    if (filters.to) {
      query.set("to", filters.to);
    }

    const queryString = query.toString();
    const path =
      period === "custom"
        ? `/reports/sales${queryString ? `?${queryString}` : ""}`
        : `/reports/${period}`;

    return this.request<SalesSummaryReport>(path);
  }

  async getBestSellers(filters: {
    from?: string;
    to?: string;
    limit?: number;
  }) {
    const query = toQueryString(filters);
    return this.request<BestSellersReport>(
      `/reports/best-sellers${query ? `?${query}` : ""}`,
    );
  }

  async getLowStock() {
    return this.request<LowStockReportItem[]>("/reports/low-stock");
  }

  async getRecentSales(filters: {
    from?: string;
    to?: string;
    limit?: number;
  }) {
    const query = toQueryString({
      ...filters,
      status: "COMPLETED",
    });
    return this.request<Sale[]>(`/sales${query ? `?${query}` : ""}`);
  }

  async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const response = await this.send(path, options);

    if (response.status === 401 && options.retryOnUnauthorized !== false) {
      try {
        await this.refreshSession();
        return this.request<T>(path, {
          ...options,
          retryOnUnauthorized: false,
        });
      } catch (error) {
        this.clearSession();
        if (error instanceof ApiError) {
          throw error;
        }
      }
    }

    return this.parseResponse<T>(response);
  }

  private async send(path: string, options: RequestOptions) {
    const headers = new Headers(options.headers);
    if (!headers.has("Content-Type") && options.body) {
      headers.set("Content-Type", "application/json");
    }
    headers.set("Accept", "application/json");

    if (this.accessToken) {
      headers.set("Authorization", `Bearer ${this.accessToken}`);
    }

    return this.fetchImpl(`${this.baseUrl}${path}`, {
      ...options,
      headers,
    });
  }

  private async parseResponse<T>(response: Response) {
    if (response.status === 204) {
      return undefined as T;
    }

    const payload = (await response
      .json()
      .catch(() => null)) as ApiEnvelope<T> | null;

    if (!response.ok || !payload?.success) {
      const error = payload && !payload.success ? payload.error : undefined;
      throw new ApiError(
        error?.message ?? "Request failed",
        response.status,
        error?.code,
      );
    }

    return payload.data;
  }
}

function toQueryString(filters: Record<string, string | number | undefined>) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined) {
      query.set(key, value.toString());
    }
  }
  return query.toString();
}

export const apiClient = new ApiClient();
