import { afterEach, describe, expect, it } from "vitest";
import { getEnv, parseCorsOrigins, resetEnvForTests } from "../config/env.js";

const originalEnv = { ...process.env };

function setBaseEnv(overrides: NodeJS.ProcessEnv = {}) {
  process.env = {
    ...originalEnv,
    NODE_ENV: "test",
    DATABASE_URL: "postgresql://test:test@localhost:5432/monumental_test",
    JWT_ACCESS_SECRET: "test-access-secret-with-more-than-32-characters",
    JWT_REFRESH_SECRET: "test-refresh-secret-with-more-than-32-characters",
    ...overrides,
  };
  resetEnvForTests();
}

describe("environment configuration", () => {
  afterEach(() => {
    process.env = { ...originalEnv };
    resetEnvForTests();
  });

  it("keeps development and test configuration usable with safe defaults", () => {
    setBaseEnv({ CORS_ORIGIN: "" });

    const env = getEnv();

    expect(env.NODE_ENV).toBe("test");
    expect(env.CORS_ORIGIN).toBe("http://localhost:5173");
    expect(env.REFRESH_TOKEN_COOKIE_SAME_SITE).toBe("lax");
  });

  it("requires explicit production CORS origins and production-specific JWT secrets", () => {
    setBaseEnv({
      NODE_ENV: "production",
      CORS_ORIGIN: "",
      JWT_ACCESS_SECRET: "test-access-secret-with-more-than-32-characters",
      JWT_REFRESH_SECRET: "test-refresh-secret-with-more-than-32-characters",
    });

    expect(() => getEnv()).toThrow(/CORS_ORIGIN is required in production/);
    expect(() => getEnv()).toThrow(
      /JWT_ACCESS_SECRET must be production-specific/,
    );
    expect(() => getEnv()).toThrow(
      /JWT_REFRESH_SECRET must be production-specific/,
    );
  });

  it("rejects wildcard credentialed CORS and insecure SameSite=None cookies", () => {
    setBaseEnv({
      CORS_ORIGIN: "*",
      REFRESH_TOKEN_COOKIE_SAME_SITE: "none",
      REFRESH_TOKEN_COOKIE_SECURE: "false",
    });

    expect(() => getEnv()).toThrow(/CORS_ORIGIN cannot use '\*'/);
    expect(() => getEnv()).toThrow(
      /SameSite=None requires secure refresh cookies/,
    );
  });

  it("parses comma-separated CORS origins", () => {
    expect(
      parseCorsOrigins("https://shop.example.com, https://admin.example.com"),
    ).toEqual(["https://shop.example.com", "https://admin.example.com"]);
  });
});
