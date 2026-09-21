import type { Request, Response } from "express";
import type { DatabaseClient } from "../lib/database.js";

export function health(_req: Request, res: Response) {
  res.json({
    success: true,
    data: {
      status: "ok",
    },
  });
}

export function readiness(db: DatabaseClient) {
  return async (_req: Request, res: Response) => {
    try {
      await db.$queryRaw`SELECT 1`;
      res.json({
        success: true,
        data: {
          status: "ready",
        },
      });
    } catch {
      res.status(503).json({
        success: false,
        error: {
          code: "NOT_READY",
          message: "Application dependencies are not ready",
        },
      });
    }
  };
}
