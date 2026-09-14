import type { NextFunction, Request, RequestHandler, Response } from "express";

type AsyncRouteHandler<P = Record<string, string>> = (
  req: Request<P>,
  res: Response,
  next: NextFunction,
) => Promise<void>;

export function asyncHandler<P = Record<string, string>>(
  handler: AsyncRouteHandler<P>,
): RequestHandler<P> {
  return (req, res, next) => {
    void handler(req, res, next).catch(next);
  };
}
