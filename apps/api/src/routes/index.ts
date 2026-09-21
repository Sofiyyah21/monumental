import { Router } from "express";
import type { RequestHandler } from "express";
import { AuthController } from "../controllers/auth.controller.js";
import { health } from "../controllers/health.controller.js";
import { InventoryController } from "../controllers/inventory.controller.js";
import { OrderController } from "../controllers/order.controller.js";
import { ProductController } from "../controllers/product.controller.js";
import { ReportController } from "../controllers/report.controller.js";
import { SaleController } from "../controllers/sale.controller.js";
import { AuthService } from "../services/auth.service.js";
import { InventoryService } from "../services/inventory.service.js";
import { OrderService } from "../services/order.service.js";
import { ProductService } from "../services/product.service.js";
import { ReportService } from "../services/report.service.js";
import { SaleService } from "../services/sale.service.js";
import { prisma } from "../lib/prisma.js";
import type { DatabaseClient } from "../lib/database.js";
import {
  createNotificationService,
  type NotificationProvider,
} from "../services/notification.service.js";
import { createAuthenticate } from "../middleware/auth.js";
import { createAuthRoutes } from "./auth.routes.js";
import { createInventoryRoutes } from "./inventory.routes.js";
import { createOrderRoutes } from "./order.routes.js";
import { createProductRoutes } from "./product.routes.js";
import { createReportRoutes } from "./report.routes.js";
import { createSaleRoutes } from "./sale.routes.js";

export type ApiRouterOptions = {
  notificationProvider?: NotificationProvider;
  authRateLimit?: RequestHandler;
  orderRateLimit?: RequestHandler;
};

export function createApiRouter(
  db: DatabaseClient = prisma,
  options: ApiRouterOptions = {},
) {
  const router = Router();
  const authenticateRequest = createAuthenticate(db);
  const notificationService = createNotificationService(
    options.notificationProvider,
  );

  const authController = new AuthController(new AuthService(db));
  const productController = new ProductController(new ProductService(db));
  const inventoryController = new InventoryController(new InventoryService(db));
  const orderController = new OrderController(
    new OrderService(db, notificationService),
  );
  const saleController = new SaleController(new SaleService(db));
  const reportController = new ReportController(new ReportService(db));

  router.get("/health", health);
  router.use(
    "/auth",
    createAuthRoutes(
      authController,
      authenticateRequest,
      options.authRateLimit,
    ),
  );
  router.use(
    "/products",
    createProductRoutes(productController, authenticateRequest),
  );
  router.use(
    "/inventory",
    createInventoryRoutes(inventoryController, authenticateRequest),
  );
  router.use(
    "/orders",
    createOrderRoutes(
      orderController,
      authenticateRequest,
      options.orderRateLimit,
    ),
  );
  router.use("/sales", createSaleRoutes(saleController, authenticateRequest));
  router.use(
    "/reports",
    createReportRoutes(reportController, authenticateRequest),
  );

  return router;
}
