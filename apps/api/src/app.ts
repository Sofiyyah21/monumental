import cors from "cors";
import type { RequestHandler } from "express";
import express from "express";
import swaggerUi from "swagger-ui-express";
import { getEnv } from "./config/env.js";
import { health, readiness } from "./controllers/health.controller.js";
import { openApiDocument } from "./docs/openapi.js";
import type { DatabaseClient } from "./lib/database.js";
import { prisma } from "./lib/prisma.js";
import { errorHandler } from "./middleware/error-handler.js";
import { notFoundHandler } from "./middleware/not-found.js";
import { createRateLimiter } from "./middleware/rate-limit.js";
import { requestId } from "./middleware/request-id.js";
import { requestLogging } from "./middleware/request-logging.js";
import { createCorsOptions, securityHeaders } from "./middleware/security.js";
import { createApiRouter, type ApiRouterOptions } from "./routes/index.js";

export type AppOptions = ApiRouterOptions;

export function createApp(
  db: DatabaseClient = prisma,
  options: AppOptions = {},
) {
  const app = express();
  const env = getEnv();

  app.disable("x-powered-by");
  app.set("trust proxy", env.NODE_ENV === "production" ? 1 : false);

  app.use(requestId);
  app.use(requestLogging);
  app.use(securityHeaders(env));
  app.use(cors(createCorsOptions(env)));
  app.use(express.json({ limit: env.JSON_BODY_LIMIT }));
  app.use(
    express.urlencoded({ extended: false, limit: env.URLENCODED_BODY_LIMIT }),
  );

  app.get("/health", health);
  app.get("/ready", readiness(db));

  app.get("/api/v1/health", health);
  app.get("/api/v1/ready", readiness(db));

  const enableApiDocs =
    env.ENABLE_API_DOCS === undefined
      ? env.NODE_ENV !== "production"
      : env.ENABLE_API_DOCS === "true";
  if (enableApiDocs) {
    app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(openApiDocument));
  }

  const authRateLimit = createConfiguredRateLimiter("auth", {
    windowMs: env.AUTH_RATE_LIMIT_WINDOW_MS,
    max: env.AUTH_RATE_LIMIT_MAX,
  });
  const orderRateLimit = createConfiguredRateLimiter("orders", {
    windowMs: env.ORDER_RATE_LIMIT_WINDOW_MS,
    max: env.ORDER_RATE_LIMIT_MAX,
  });

  app.use(
    "/api/v1",
    createApiRouter(db, {
      ...options,
      authRateLimit,
      orderRateLimit,
    }),
  );

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

function createConfiguredRateLimiter(
  keyPrefix: string,
  options: { windowMs: number; max: number },
): RequestHandler {
  if (getEnv().NODE_ENV === "test") {
    return (_req, _res, next) => {
      next();
    };
  }

  return createRateLimiter({
    keyPrefix,
    ...options,
  });
}
