import type { CorsOptionsDelegate } from "cors";
import type { RequestHandler } from "express";
import type { Env } from "../config/env.js";
import { parseCorsOrigins } from "../config/env.js";
import { AppError } from "../lib/app-error.js";

export function createCorsOptions(env: Env): CorsOptionsDelegate {
  const allowedOrigins = new Set(parseCorsOrigins(env.CORS_ORIGIN ?? ""));

  return (req, callback) => {
    const rawOrigin = req.headers.origin;
    const origin = Array.isArray(rawOrigin) ? rawOrigin[0] : rawOrigin;
    if (!origin) {
      callback(null, { credentials: true, origin: false });
      return;
    }

    if (allowedOrigins.has(origin)) {
      callback(null, { credentials: true, origin });
      return;
    }

    callback(
      new AppError("Origin is not allowed by CORS policy", 403, "CORS_DENIED"),
    );
  };
}

export function securityHeaders(env: Env): RequestHandler {
  return (_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("Cross-Origin-Resource-Policy", "same-site");
    res.setHeader("X-DNS-Prefetch-Control", "off");
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
    );

    if (env.NODE_ENV === "production") {
      res.setHeader(
        "Strict-Transport-Security",
        "max-age=15552000; includeSubDomains",
      );
    }

    next();
  };
}
