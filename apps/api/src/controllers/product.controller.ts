import { UserRole } from "@prisma/client";
import type { Request, Response } from "express";
import { AppError } from "../lib/app-error.js";
import { ProductService } from "../services/product.service.js";

export class ProductController {
  constructor(private readonly productService: ProductService) {}

  list = async (req: Request, res: Response) => {
    const result =
      req.user?.role === UserRole.CUSTOMER
        ? await this.productService.listCustomerCatalog(req.query)
        : await this.productService.list(req.query);
    res.json({ success: true, data: result });
  };

  getById = async (req: Request<{ id: string }>, res: Response) => {
    const id = req.params.id;
    if (!id) {
      throw new AppError(
        "Product id route parameter is required",
        400,
        "PRODUCT_ID_REQUIRED",
      );
    }

    const result = await this.productService.getById(id);
    res.json({ success: true, data: result });
  };

  create = async (req: Request, res: Response) => {
    const result = await this.productService.create(req.body);
    res.status(201).json({ success: true, data: result });
  };

  update = async (req: Request<{ id: string }>, res: Response) => {
    const id = req.params.id;
    if (!id) {
      throw new AppError(
        "Product id route parameter is required",
        400,
        "PRODUCT_ID_REQUIRED",
      );
    }
    const result = await this.productService.update(id, req.body);
    res.json({ success: true, data: result });
  };

  deactivate = async (req: Request<{ id: string }>, res: Response) => {
    const id = req.params.id;
    if (!id) {
      throw new AppError(
        "Product id route parameter is required",
        400,
        "PRODUCT_ID_REQUIRED",
      );
    }

    const result = await this.productService.deactivate(id);
    res.json({ success: true, data: result });
  };
}
