import { createApp } from "./app.js";
import { getEnv } from "./config/env.js";
import { logger } from "./lib/logger.js";
import { prisma } from "./lib/prisma.js";

const app = createApp();
const env = getEnv();
const server = app.listen(env.PORT, () => {
  logger.info("Server started", { port: env.PORT, nodeEnv: env.NODE_ENV });
});

let shuttingDown = false;

async function shutdown(signal: NodeJS.Signals) {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  logger.info("Shutdown signal received", { signal });

  const forceExit = setTimeout(() => {
    logger.error("Graceful shutdown timed out", { signal });
    process.exit(1);
  }, env.SHUTDOWN_GRACE_MS);
  forceExit.unref();

  server.close(async (error) => {
    if (error) {
      logger.error("HTTP server close failed", { errorName: error.name });
      process.exitCode = 1;
    }

    await prisma.$disconnect();
    logger.info("Shutdown complete", { signal });
    clearTimeout(forceExit);
    process.exit(process.exitCode ?? 0);
  });
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
