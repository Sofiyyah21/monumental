import { Router } from "express";
import type { RequestHandler } from "express";
import { SaleController } from "../controllers/sale.controller.js";
import { permissions } from "../authorization/permissions.js";
import { asyncHandler } from "../lib/async-handler.js";
import { authenticate, authorizePermission } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import {
  createSaleSchema,
  listSalesQuerySchema,
  saleIdParamSchema,
} from "../validation/sale.schema.js";

export function createSaleRoutes(
  controller: SaleController,
  authenticateRequest: RequestHandler = authenticate,
) {
  const router = Router();

  router.get(
    "/",
    authenticateRequest,
    authorizePermission(permissions.READ_SALES),
    validate({ query: listSalesQuerySchema }),
    asyncHandler(controller.list),
  );
  router.get(
    "/:id",
    authenticateRequest,
    authorizePermission(permissions.READ_SALES),
    validate({ params: saleIdParamSchema }),
    asyncHandler(controller.getById),
  );
  router.post(
    "/",
    authenticateRequest,
    authorizePermission(permissions.CREATE_SALES),
    validate({ body: createSaleSchema }),
    asyncHandler(controller.create),
  );

  return router;
}
