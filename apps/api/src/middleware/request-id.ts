import crypto from "node:crypto";
import type { RequestHandler } from "express";

const requestIdPattern = /^[A-Za-z0-9._:-]{1,128}$/;

declare module "express-serve-static-core" {
  interface Request {
    requestId?: string;
  }
}

export const requestId: RequestHandler = (req, res, next) => {
  const incoming = req.get("x-request-id");
  const id =
    incoming && requestIdPattern.test(incoming)
      ? incoming
      : crypto.randomUUID();

  req.requestId = id;
  res.setHeader("X-Request-Id", id);
  next();
};
