import type { NextFunction, Request, Response } from "express";
import type { ZodType } from "zod";

type RequestSchemas = {
  body?: ZodType;
  params?: ZodType;
  query?: ZodType;
};

export function validate(schemas: RequestSchemas) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (schemas.body) {
      req.body = schemas.body.parse(req.body);
    }
    if (schemas.params) {
      Object.assign(req.params, schemas.params.parse(req.params));
    }
    if (schemas.query) {
      Object.assign(req.query, schemas.query.parse(req.query));
    }
    next();
  };
}
