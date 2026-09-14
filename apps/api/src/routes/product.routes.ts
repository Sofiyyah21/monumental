import { Router } from "express";
import type { RequestHandler } from "express";
import { ProductController } from "../controllers/product.controller.js";
import { permissions } from "../authorization/permissions.js";
import { asyncHandler } from "../lib/async-handler.js";
import { authenticate, authorizePermission } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { cuidParamSchema } from "../validation/common.js";
import {
  createProductSchema,
  listProductsQuerySchema,
  updateProductSchema,
} from "../validation/product.schema.js";

export function createProductRoutes(
  controller: ProductController,
  authenticateRequest: RequestHandler = authenticate,
) {
  const router = Router();

  router.get(
    "/",
    authenticateRequest,
    authorizePermission(permissions.READ_PRODUCTS),
    validate({ query: listProductsQuerySchema }),
    asyncHandler(controller.list),
  );
  router.post(
    "/",
    authenticateRequest,
    authorizePermission(permissions.MANAGE_PRODUCTS),
    validate({ body: createProductSchema }),
    asyncHandler(controller.create),
  );
  router.patch(
    "/:id",
    authenticateRequest,
    authorizePermission(permissions.MANAGE_PRODUCTS),
    validate({ params: cuidParamSchema, body: updateProductSchema }),
    asyncHandler(controller.update),
  );

  return router;
}
