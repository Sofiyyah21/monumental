import type { CookieOptions, Request, Response } from "express";
import { getEnv } from "../config/env.js";
import { AppError } from "./app-error.js";

export function getRefreshTokenCookie(req: Request) {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) {
    return undefined;
  }

  const cookieName = getEnv().REFRESH_TOKEN_COOKIE_NAME;
  for (const pair of cookieHeader.split(";")) {
    const [rawName, ...rawValueParts] = pair.trim().split("=");
    if (rawName === cookieName) {
      const rawValue = rawValueParts.join("=");
      return rawValue ? decodeURIComponent(rawValue) : undefined;
    }
  }
  return undefined;
}

export function setRefreshTokenCookie(res: Response, refreshToken: string) {
  res.cookie(getEnv().REFRESH_TOKEN_COOKIE_NAME, refreshToken, {
    ...getRefreshTokenCookieOptions(),
    maxAge: getRefreshTokenMaxAgeMs(),
  });
}

export function clearRefreshTokenCookie(res: Response) {
  res.clearCookie(getEnv().REFRESH_TOKEN_COOKIE_NAME, {
    ...getRefreshTokenCookieOptions(),
    maxAge: undefined,
  });
}

export function assertTrustedCookieRequest(req: Request) {
  const origin = req.get("origin");
  if (!origin) {
    return;
  }

  if (origin !== getEnv().CORS_ORIGIN) {
    throw new AppError(
      "Cookie-authenticated request came from an untrusted origin",
      403,
      "CSRF_ORIGIN_INVALID",
    );
  }
}

function getRefreshTokenCookieOptions(): CookieOptions {
  const env = getEnv();
  const sameSite = env.REFRESH_TOKEN_COOKIE_SAME_SITE;
  const configuredSecure = env.REFRESH_TOKEN_COOKIE_SECURE;
  const secure =
    sameSite === "none" ||
    (configuredSecure === undefined
      ? env.NODE_ENV === "production"
      : configuredSecure === "true");

  return {
    httpOnly: true,
    secure,
    sameSite,
    path: env.REFRESH_TOKEN_COOKIE_PATH,
    domain: env.REFRESH_TOKEN_COOKIE_DOMAIN,
  };
}

function getRefreshTokenMaxAgeMs() {
  return getEnv().REFRESH_TOKEN_EXPIRES_IN_DAYS * 24 * 60 * 60 * 1000;
}
