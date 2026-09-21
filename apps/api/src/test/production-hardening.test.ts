import type { NextFunction, Request, Response } from "express";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Env } from "../config/env.js";
import { resetEnvForTests } from "../config/env.js";
import { readiness } from "../controllers/health.controller.js";
import type { DatabaseClient } from "../lib/database.js";
import {
  assertTrustedCookieRequest,
  setRefreshTokenCookie,
} from "../lib/auth-cookie.js";
import { errorHandler } from "../middleware/error-handler.js";
import {
  createRateLimiter,
  resetRateLimitersForTests,
} from "../middleware/rate-limit.js";
import { requestId } from "../middleware/request-id.js";
import { createCorsOptions, securityHeaders } from "../middleware/security.js";

const originalEnv = { ...process.env };

const baseEnv: Env = {
  NODE_ENV: "production",
  PORT: 3000,
  DATABASE_URL: "postgresql://test:test@localhost:5432/monumental_test",
  TEST_DATABASE_URL: undefined,
  CORS_ORIGIN: "https://shop.example.com,https://admin.example.com",
  JWT_ACCESS_SECRET: "production-access-secret-with-more-than-32-characters",
  JWT_REFRESH_SECRET: "production-refresh-secret-with-more-than-32-characters",
  ACCESS_TOKEN_EXPIRES_IN: "15m",
  REFRESH_TOKEN_EXPIRES_IN_DAYS: 30,
  REFRESH_TOKEN_COOKIE_NAME: "md_refresh_token",
  REFRESH_TOKEN_COOKIE_PATH: "/api/v1/auth",
  REFRESH_TOKEN_COOKIE_DOMAIN: undefined,
  REFRESH_TOKEN_COOKIE_SECURE: undefined,
  REFRESH_TOKEN_COOKIE_SAME_SITE: "lax",
  JSON_BODY_LIMIT: "100kb",
  URLENCODED_BODY_LIMIT: "100kb",
  AUTH_RATE_LIMIT_WINDOW_MS: 60_000,
  AUTH_RATE_LIMIT_MAX: 2,
  ORDER_RATE_LIMIT_WINDOW_MS: 60_000,
  ORDER_RATE_LIMIT_MAX: 60,
  SHUTDOWN_GRACE_MS: 10_000,
  ENABLE_API_DOCS: undefined,
  BCRYPT_SALT_ROUNDS: 12,
  BUSINESS_TIMEZONE: "Africa/Lagos",
  BOOTSTRAP_ADMIN_EMAIL: undefined,
  BOOTSTRAP_ADMIN_NAME: undefined,
  BOOTSTRAP_ADMIN_PASSWORD: undefined,
};

function setRuntimeEnv(overrides: NodeJS.ProcessEnv = {}) {
  process.env = {
    ...originalEnv,
    NODE_ENV: "production",
    DATABASE_URL: "postgresql://test:test@localhost:5432/monumental_test",
    CORS_ORIGIN: "https://shop.example.com,https://admin.example.com",
    JWT_ACCESS_SECRET: "production-access-secret-with-more-than-32-characters",
    JWT_REFRESH_SECRET:
      "production-refresh-secret-with-more-than-32-characters",
    ...overrides,
  };
  resetEnvForTests();
}

function createResponseMock() {
  const headers = new Map<string, string>();
  const response = {
    statusCode: 200,
    body: undefined as unknown,
    headers,
    setHeader(name: string, value: string) {
      headers.set(name, value);
      return response;
    },
    status(code: number) {
      response.statusCode = code;
      return response;
    },
    json(body: unknown) {
      response.body = body;
      return response;
    },
    cookie: vi.fn(),
  };
  return response;
}

describe("production hardening", () => {
  afterEach(() => {
    process.env = { ...originalEnv };
    resetEnvForTests();
    resetRateLimitersForTests();
    vi.restoreAllMocks();
  });

  it("accepts only configured credentialed CORS origins", () => {
    const corsOptions = createCorsOptions(baseEnv);

    corsOptions(
      {
        headers: { origin: "https://shop.example.com" },
      } as unknown as Request,
      (error, options) => {
        expect(error).toBeNull();
        expect(options).toMatchObject({
          credentials: true,
          origin: "https://shop.example.com",
        });
      },
    );

    corsOptions(
      {
        headers: { origin: "https://evil.example.com" },
      } as unknown as Request,
      (error) => {
        expect(error).toMatchObject({ code: "CORS_DENIED", statusCode: 403 });
      },
    );
  });

  it("trusts refresh-cookie requests only from configured origins", () => {
    setRuntimeEnv();

    expect(() =>
      assertTrustedCookieRequest({
        get: (name: string) =>
          name === "origin" ? "https://admin.example.com" : undefined,
      } as unknown as Request),
    ).not.toThrow();

    expect(() =>
      assertTrustedCookieRequest({
        get: (name: string) =>
          name === "origin" ? "https://evil.example.com" : undefined,
      } as unknown as Request),
    ).toThrow(/untrusted origin/);
  });

  it("sets hardened refresh-cookie attributes in production", () => {
    setRuntimeEnv();
    const response = createResponseMock();

    setRefreshTokenCookie(response as unknown as Response, "refresh-token");

    expect(response.cookie).toHaveBeenCalledWith(
      "md_refresh_token",
      "refresh-token",
      expect.objectContaining({
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        path: "/api/v1/auth",
        maxAge: 30 * 24 * 60 * 60 * 1000,
      }),
    );
  });

  it("sets conservative security headers", () => {
    const response = createResponseMock();

    securityHeaders(baseEnv)(
      {} as Request,
      response as unknown as Response,
      vi.fn() as NextFunction,
    );

    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(response.headers.get("X-Frame-Options")).toBe("DENY");
    expect(response.headers.get("Referrer-Policy")).toBe("no-referrer");
    expect(response.headers.get("Strict-Transport-Security")).toContain(
      "max-age=",
    );
    expect(response.headers.get("Content-Security-Policy")).toContain(
      "default-src 'none'",
    );
  });

  it("adds a bounded request correlation id", () => {
    const response = createResponseMock();
    const next = vi.fn();
    const req = {
      get: (name: string) =>
        name === "x-request-id" ? "request-123" : undefined,
    } as unknown as Request;

    requestId(req, response as unknown as Response, next);

    expect(req.requestId).toBe("request-123");
    expect(response.headers.get("X-Request-Id")).toBe("request-123");
    expect(next).toHaveBeenCalledOnce();
  });

  it("limits repeated sensitive endpoint attempts by client", () => {
    const limiter = createRateLimiter({
      keyPrefix: "auth-test",
      windowMs: 60_000,
      max: 1,
    });
    const req = { ip: "127.0.0.1" } as Request;
    const firstResponse = createResponseMock();
    const secondResponse = createResponseMock();
    const firstNext = vi.fn();
    const secondNext = vi.fn();

    limiter(req, firstResponse as unknown as Response, firstNext);
    limiter(req, secondResponse as unknown as Response, secondNext);

    expect(firstNext).toHaveBeenCalledWith();
    expect(secondNext.mock.calls[0]?.[0]).toMatchObject({
      code: "RATE_LIMITED",
      statusCode: 429,
    });
    expect(secondResponse.headers.get("Retry-After")).toBeDefined();
  });

  it("sanitizes unexpected production errors", () => {
    setRuntimeEnv();
    const response = createResponseMock();
    const req = {
      method: "GET",
      path: "/api/v1/products",
      requestId: "request-123",
    } as Request;

    errorHandler(
      new Error("database password leaked at /private/path"),
      req,
      response as unknown as Response,
      vi.fn(),
    );

    expect(response.statusCode).toBe(500);
    expect(response.body).toEqual({
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "Unexpected server error",
        requestId: "request-123",
      },
    });
  });

  it("returns a safe error for oversized request bodies", () => {
    const response = createResponseMock();
    const req = {
      method: "POST",
      path: "/api/v1/auth/login",
      requestId: "request-123",
    } as Request;
    const oversizedError = { status: 413, message: "request entity too large" };

    errorHandler(oversizedError, req, response as unknown as Response, vi.fn());

    expect(response.statusCode).toBe(413);
    expect(response.body).toEqual({
      success: false,
      error: {
        code: "REQUEST_TOO_LARGE",
        message: "Request body is too large",
        requestId: "request-123",
      },
    });
  });

  it("reports readiness without leaking database internals", async () => {
    const response = createResponseMock();
    const db = {
      $queryRaw: vi.fn().mockRejectedValue(new Error("DATABASE_URL secret")),
    } as unknown as DatabaseClient;

    await readiness(db)({} as Request, response as unknown as Response);

    expect(response.statusCode).toBe(503);
    expect(response.body).toEqual({
      success: false,
      error: {
        code: "NOT_READY",
        message: "Application dependencies are not ready",
      },
    });
  });
});
