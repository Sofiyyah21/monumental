import { Router } from "express";
import { UserRole } from "@prisma/client";
import type { RequestHandler } from "express";
import { ProductController } from "../controllers/product.controller.js";
import {
  permissions,
  roleHasPermission,
} from "../authorization/permissions.js";
import { AppError } from "../lib/app-error.js";
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
    authorizeProductList,
    validate({ query: listProductsQuerySchema }),
    asyncHandler(controller.list),
  );
  router.get(
    "/:id",
    authenticateRequest,
    authorizePermission(permissions.READ_PRODUCTS),
    validate({ params: cuidParamSchema }),
    asyncHandler(controller.getById),
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
  router.patch(
    "/:id/deactivate",
    authenticateRequest,
    authorizePermission(permissions.MANAGE_PRODUCTS),
    validate({ params: cuidParamSchema }),
    asyncHandler(controller.deactivate),
  );

  return router;
}

const authorizeProductList: RequestHandler = (req, _res, next) => {
  if (!req.user) {
    next(new AppError("Authentication required", 401, "AUTH_REQUIRED"));
    return;
  }

  if (
    req.user.role === UserRole.CUSTOMER ||
    roleHasPermission(req.user.role, permissions.READ_PRODUCTS)
  ) {
    next();
    return;
  }

  next(
    new AppError(
      "You do not have permission to perform this action",
      403,
      "FORBIDDEN",
    ),
  );
};
