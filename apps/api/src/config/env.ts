import dotenv from "dotenv";
import { z } from "zod";

dotenv.config({ quiet: true });

const optionalNonEmptyString = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().min(1).optional(),
);

const optionalBooleanString = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.enum(["true", "false"]).optional(),
);

const envSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    PORT: z.coerce.number().int().positive().default(3000),
    DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
    TEST_DATABASE_URL: z.string().optional(),
    CORS_ORIGIN: z.string().optional(),
    JWT_ACCESS_SECRET: z
      .string()
      .min(32, "JWT_ACCESS_SECRET must be at least 32 characters"),
    JWT_REFRESH_SECRET: z
      .string()
      .min(32, "JWT_REFRESH_SECRET must be at least 32 characters"),
    ACCESS_TOKEN_EXPIRES_IN: z.string().default("15m"),
    REFRESH_TOKEN_EXPIRES_IN_DAYS: z.coerce
      .number()
      .int()
      .positive()
      .default(30),
    REFRESH_TOKEN_COOKIE_NAME: z.string().min(1).default("md_refresh_token"),
    REFRESH_TOKEN_COOKIE_PATH: z.string().min(1).default("/api/v1/auth"),
    REFRESH_TOKEN_COOKIE_DOMAIN: optionalNonEmptyString,
    REFRESH_TOKEN_COOKIE_SECURE: optionalBooleanString,
    REFRESH_TOKEN_COOKIE_SAME_SITE: z
      .enum(["lax", "strict", "none"])
      .default("lax"),
    JSON_BODY_LIMIT: z.string().min(1).default("100kb"),
    URLENCODED_BODY_LIMIT: z.string().min(1).default("100kb"),
    AUTH_RATE_LIMIT_WINDOW_MS: z.coerce
      .number()
      .int()
      .positive()
      .default(15 * 60 * 1000),
    AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(20),
    ORDER_RATE_LIMIT_WINDOW_MS: z.coerce
      .number()
      .int()
      .positive()
      .default(60 * 1000),
    ORDER_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(60),
    SHUTDOWN_GRACE_MS: z.coerce.number().int().positive().default(10_000),
    ENABLE_API_DOCS: optionalBooleanString,
    BCRYPT_SALT_ROUNDS: z.coerce.number().int().min(10).max(15).default(12),
    BUSINESS_TIMEZONE: z.string().default("Africa/Lagos"),
    BOOTSTRAP_ADMIN_EMAIL: z.string().email().optional(),
    BOOTSTRAP_ADMIN_NAME: z.string().min(1).optional(),
    BOOTSTRAP_ADMIN_PASSWORD: z.string().min(12).optional(),
  })
  .superRefine((env, context) => {
    const isProduction = env.NODE_ENV === "production";

    if (!env.CORS_ORIGIN && !isProduction) {
      env.CORS_ORIGIN = "http://localhost:5173";
    }

    if (!env.CORS_ORIGIN) {
      context.addIssue({
        code: "custom",
        path: ["CORS_ORIGIN"],
        message: "CORS_ORIGIN is required in production",
      });
    }

    const origins = parseCorsOrigins(env.CORS_ORIGIN ?? "");
    if (origins.includes("*")) {
      context.addIssue({
        code: "custom",
        path: ["CORS_ORIGIN"],
        message: "CORS_ORIGIN cannot use '*' when credentials are enabled",
      });
    }

    if (env.REFRESH_TOKEN_COOKIE_SAME_SITE === "none") {
      const secure =
        env.REFRESH_TOKEN_COOKIE_SECURE === undefined
          ? isProduction
          : env.REFRESH_TOKEN_COOKIE_SECURE === "true";
      if (!secure) {
        context.addIssue({
          code: "custom",
          path: ["REFRESH_TOKEN_COOKIE_SECURE"],
          message: "SameSite=None requires secure refresh cookies",
        });
      }
    }

    if (isProduction) {
      if (env.JWT_ACCESS_SECRET.includes("test-")) {
        context.addIssue({
          code: "custom",
          path: ["JWT_ACCESS_SECRET"],
          message: "JWT_ACCESS_SECRET must be production-specific",
        });
      }
      if (env.JWT_REFRESH_SECRET.includes("test-")) {
        context.addIssue({
          code: "custom",
          path: ["JWT_REFRESH_SECRET"],
          message: "JWT_REFRESH_SECRET must be production-specific",
        });
      }
      if (env.REFRESH_TOKEN_COOKIE_SECURE === "false") {
        context.addIssue({
          code: "custom",
          path: ["REFRESH_TOKEN_COOKIE_SECURE"],
          message: "Secure refresh cookies are required in production",
        });
      }
    }
  });

export type Env = z.infer<typeof envSchema>;

let cachedEnv: Env | undefined;

export function getEnv(): Env {
  if (cachedEnv) {
    return cachedEnv;
  }

  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const message = parsed.error.issues
      .map((issue) => issue.message)
      .join("; ");
    throw new Error(`Invalid environment configuration: ${message}`);
  }

  cachedEnv = parsed.data;
  return cachedEnv;
}

export function parseCorsOrigins(value: string) {
  return value
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export function resetEnvForTests() {
  cachedEnv = undefined;
}
