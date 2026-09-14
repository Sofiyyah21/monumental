import cors from "cors";
import express from "express";
import swaggerUi from "swagger-ui-express";
import { getEnv } from "./config/env.js";
import { openApiDocument } from "./docs/openapi.js";
import type { DatabaseClient } from "./lib/database.js";
import { prisma } from "./lib/prisma.js";
import { errorHandler } from "./middleware/error-handler.js";
import { notFoundHandler } from "./middleware/not-found.js";
import { createApiRouter } from "./routes/index.js";

export function createApp(db: DatabaseClient = prisma) {
  const app = express();
  const env = getEnv();

  app.use(cors({ origin: env.CORS_ORIGIN }));
  app.use(express.json());

  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(openApiDocument));
  app.use("/api/v1", createApiRouter(db));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
