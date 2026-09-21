import type { RequestHandler } from "express";
import { AppError } from "../lib/app-error.js";

type RateLimitOptions = {
  windowMs: number;
  max: number;
  keyPrefix: string;
};

type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

export function createRateLimiter(options: RateLimitOptions): RequestHandler {
  return (req, res, next) => {
    const now = Date.now();
    const key = `${options.keyPrefix}:${req.ip ?? "unknown"}`;
    const bucket = buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + options.windowMs });
      res.setHeader("RateLimit-Limit", String(options.max));
      res.setHeader("RateLimit-Remaining", String(options.max - 1));
      next();
      return;
    }

    if (bucket.count >= options.max) {
      res.setHeader("RateLimit-Limit", String(options.max));
      res.setHeader("RateLimit-Remaining", "0");
      res.setHeader(
        "Retry-After",
        String(Math.ceil((bucket.resetAt - now) / 1000)),
      );
      next(new AppError("Too many requests", 429, "RATE_LIMITED"));
      return;
    }

    bucket.count += 1;
    res.setHeader("RateLimit-Limit", String(options.max));
    res.setHeader("RateLimit-Remaining", String(options.max - bucket.count));
    next();
  };
}

export function resetRateLimitersForTests() {
  buckets.clear();
}
