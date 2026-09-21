import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import { getEnv } from "../config/env.js";
import { isAppError } from "../lib/app-error.js";
import { logger } from "../lib/logger.js";

export const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  void _next;
  const requestId = req.requestId;

  if (error instanceof ZodError) {
    res.status(400).json({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Request validation failed",
        details: error.issues,
        requestId,
      },
    });
    return;
  }

  if (isAppError(error)) {
    res.status(error.statusCode).json({
      success: false,
      error: {
        code: error.code,
        message: error.message,
        requestId,
      },
    });
    return;
  }

  const parserStatus = getParserErrorStatus(error);
  if (parserStatus === 413 || parserStatus === 400) {
    res.status(parserStatus).json({
      success: false,
      error: {
        code: parserStatus === 413 ? "REQUEST_TOO_LARGE" : "MALFORMED_REQUEST",
        message:
          parserStatus === 413
            ? "Request body is too large"
            : "Request body is malformed",
        requestId,
      },
    });
    return;
  }

  logger.error("Unexpected request error", {
    requestId,
    method: req.method,
    path: req.path,
    errorName: error instanceof Error ? error.name : "UnknownError",
  });

  const env = getEnv();
  res.status(500).json({
    success: false,
    error: {
      code: "INTERNAL_ERROR",
      message: "Unexpected server error",
      requestId,
      ...(env.NODE_ENV === "development" && error instanceof Error
        ? { detail: error.message }
        : {}),
    },
  });
};

function getParserErrorStatus(error: unknown) {
  if (!error || typeof error !== "object" || !("status" in error)) {
    return undefined;
  }

  const status = error.status;
  return status === 400 || status === 413 ? status : undefined;
}
