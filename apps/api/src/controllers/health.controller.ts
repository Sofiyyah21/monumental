import type { Request, Response } from "express";

export function health(_req: Request, res: Response) {
  res.json({
    success: true,
    data: {
      status: "ok",
    },
  });
}
