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
  refreshToken: "refresh-token",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("ApiClient", () => {
  it("logs in and stores access and refresh tokens in the configured storage", async () => {
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
      refreshToken: "refresh-token",
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
      refreshToken: "old-refresh",
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
            refreshToken: "new-refresh",
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
      refreshToken: "new-refresh",
    });
    const retryHeaders = fetchImpl.mock.calls[2]?.[1]?.headers as Headers;
    expect(retryHeaders.get("Authorization")).toBe("Bearer new-access");
  });

  it("revokes the stored refresh token on logout and clears the session", async () => {
    const storage = new MemoryTokenStorage();
    storage.write({ accessToken: "access", refreshToken: "refresh" });
    const fetchImpl = vi.fn(async () => new Response(null, { status: 204 }));
    const client = new ApiClient({ tokenStorage: storage, fetchImpl });

    await client.logout();

    expect(storage.read()).toBeNull();
    expect(fetchImpl).toHaveBeenCalledWith(
      "/api/v1/auth/logout",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ refreshToken: "refresh" }),
      }),
    );
  });
});
