import { Router } from "express";
import type { RequestHandler } from "express";
import { InventoryController } from "../controllers/inventory.controller.js";
import { permissions } from "../authorization/permissions.js";
import { asyncHandler } from "../lib/async-handler.js";
import { authenticate, authorizePermission } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import {
  adjustStockSchema,
  currentStockParamsSchema,
  inventoryListQuerySchema,
  recordDamageSchema,
  receiveStockSchema,
  returnStockSchema,
  stockMovementQuerySchema,
} from "../validation/inventory.schema.js";

export function createInventoryRoutes(
  controller: InventoryController,
  authenticateRequest: RequestHandler = authenticate,
) {
  const router = Router();

  router.get(
    "/",
    authenticateRequest,
    authorizePermission(permissions.READ_INVENTORY),
    validate({ query: inventoryListQuerySchema }),
    asyncHandler(controller.listInventory),
  );
  router.get(
    "/low-stock",
    authenticateRequest,
    authorizePermission(permissions.READ_INVENTORY),
    asyncHandler(controller.listLowStockProducts),
  );
  router.get(
    "/products/:productId",
    authenticateRequest,
    authorizePermission(permissions.READ_INVENTORY),
    validate({ params: currentStockParamsSchema }),
    asyncHandler(controller.getCurrentStock),
  );
  router.get(
    "/movements",
    authenticateRequest,
    authorizePermission(permissions.READ_INVENTORY),
    validate({ query: stockMovementQuerySchema }),
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
  router.post(
    "/damage",
    authenticateRequest,
    authorizePermission(permissions.MANAGE_INVENTORY),
    validate({ body: recordDamageSchema }),
    asyncHandler(controller.recordDamage),
  );

  return router;
}
