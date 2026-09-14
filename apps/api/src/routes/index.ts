import { Router } from "express";
import { AuthController } from "../controllers/auth.controller.js";
import { health } from "../controllers/health.controller.js";
import { InventoryController } from "../controllers/inventory.controller.js";
import { ProductController } from "../controllers/product.controller.js";
import { ReportController } from "../controllers/report.controller.js";
import { SaleController } from "../controllers/sale.controller.js";
import { AuthService } from "../services/auth.service.js";
import { InventoryService } from "../services/inventory.service.js";
import { ProductService } from "../services/product.service.js";
import { ReportService } from "../services/report.service.js";
import { SaleService } from "../services/sale.service.js";
import { prisma } from "../lib/prisma.js";
import type { DatabaseClient } from "../lib/database.js";
import { createAuthenticate } from "../middleware/auth.js";
import { createAuthRoutes } from "./auth.routes.js";
import { createInventoryRoutes } from "./inventory.routes.js";
import { createProductRoutes } from "./product.routes.js";
import { createReportRoutes } from "./report.routes.js";
import { createSaleRoutes } from "./sale.routes.js";

export function createApiRouter(db: DatabaseClient = prisma) {
  const router = Router();
  const authenticateRequest = createAuthenticate(db);

  const authController = new AuthController(new AuthService(db));
  const productController = new ProductController(new ProductService(db));
  const inventoryController = new InventoryController(new InventoryService(db));
  const saleController = new SaleController(new SaleService(db));
  const reportController = new ReportController(new ReportService(db));

  router.get("/health", health);
  router.use("/auth", createAuthRoutes(authController, authenticateRequest));
  router.use(
    "/products",
    createProductRoutes(productController, authenticateRequest),
  );
  router.use(
    "/inventory",
    createInventoryRoutes(inventoryController, authenticateRequest),
  );
  router.use("/sales", createSaleRoutes(saleController, authenticateRequest));
  router.use(
    "/reports",
    createReportRoutes(reportController, authenticateRequest),
  );

  return router;
}
