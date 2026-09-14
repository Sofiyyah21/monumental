import type { Request, Response } from "express";
import { AppError } from "../lib/app-error.js";
import { InventoryService } from "../services/inventory.service.js";

export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  receiveStock = async (req: Request, res: Response) => {
    const userId = this.requireUserId(req);
    const result = await this.inventoryService.receiveStock({
      ...req.body,
      userId,
    });
    res.status(201).json({ success: true, data: result });
  };

  adjustStock = async (req: Request, res: Response) => {
    const userId = this.requireUserId(req);
    const result = await this.inventoryService.adjustStock({
      ...req.body,
      userId,
    });
    res.status(201).json({ success: true, data: result });
  };

  returnStock = async (req: Request, res: Response) => {
    const userId = this.requireUserId(req);
    const result = await this.inventoryService.returnStock({
      ...req.body,
      userId,
    });
    res.status(201).json({ success: true, data: result });
  };

  listMovements = async (req: Request, res: Response) => {
    const limit = Number(req.query.limit ?? 50);
    const result = await this.inventoryService.listMovements(limit);
    res.json({ success: true, data: result });
  };

  private requireUserId(req: Request) {
    if (!req.user) {
      throw new AppError("Authentication required", 401, "AUTH_REQUIRED");
    }
    return req.user.id;
  }
}
