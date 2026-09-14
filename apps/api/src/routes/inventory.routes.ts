import { Router } from "express";
import type { RequestHandler } from "express";
import { InventoryController } from "../controllers/inventory.controller.js";
import { permissions } from "../authorization/permissions.js";
import { asyncHandler } from "../lib/async-handler.js";
import { authenticate, authorizePermission } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { paginationQuerySchema } from "../validation/common.js";
import {
  adjustStockSchema,
  receiveStockSchema,
  returnStockSchema,
} from "../validation/inventory.schema.js";

export function createInventoryRoutes(
  controller: InventoryController,
  authenticateRequest: RequestHandler = authenticate,
) {
  const router = Router();

  router.get(
    "/movements",
    authenticateRequest,
    authorizePermission(permissions.READ_INVENTORY),
    validate({ query: paginationQuerySchema }),
    asyncHandler(controller.listMovements),
  );
  router.post(
    "/receive",
    authenticateRequest,
    authorizePermission(permissions.MANAGE_INVENTORY),
    validate({ body: receiveStockSchema }),
    asyncHandler(controller.receiveStock),
  );
  router.post(
    "/adjust",
    authenticateRequest,
    authorizePermission(permissions.MANAGE_INVENTORY),
    validate({ body: adjustStockSchema }),
    asyncHandler(controller.adjustStock),
  );
  router.post(
    "/returns",
    authenticateRequest,
    authorizePermission(permissions.MANAGE_INVENTORY),
    validate({ body: returnStockSchema }),
    asyncHandler(controller.returnStock),
  );

  return router;
}
