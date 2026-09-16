import type { Request, Response } from "express";
import { AppError } from "../lib/app-error.js";
import { SaleService } from "../services/sale.service.js";

export class SaleController {
  constructor(private readonly saleService: SaleService) {}

  list = async (req: Request, res: Response) => {
    const result = await this.saleService.list(req.query);
    res.json({ success: true, data: result });
  };

  getById = async (req: Request<{ id: string }>, res: Response) => {
    const result = await this.saleService.getById(req.params.id);
    res.json({ success: true, data: result });
  };

  create = async (req: Request, res: Response) => {
    if (!req.user) {
      throw new AppError("Authentication required", 401, "AUTH_REQUIRED");
    }

    const result = await this.saleService.create({
      ...req.body,
      sellerId: req.user.id,
    });
    res.status(201).json({ success: true, data: result });
  };

  void = async (req: Request<{ id: string }>, res: Response) => {
    if (!req.user) {
      throw new AppError("Authentication required", 401, "AUTH_REQUIRED");
    }

    const result = await this.saleService.voidSale({
      saleId: req.params.id,
      voidedById: req.user.id,
      reason: req.body.reason,
    });
    res.json({ success: true, data: result });
  };
}
