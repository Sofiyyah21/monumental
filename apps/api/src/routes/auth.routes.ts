import { Router } from "express";
import type { RequestHandler } from "express";
import { asyncHandler } from "../lib/async-handler.js";
import { permissions } from "../authorization/permissions.js";
import { authenticate, authorizePermission } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { AuthController } from "../controllers/auth.controller.js";
import {
  createUserSchema,
  loginSchema,
  registerCustomerSchema,
} from "../validation/auth.schema.js";

export function createAuthRoutes(
  controller: AuthController,
  authenticateRequest: RequestHandler = authenticate,
  authRateLimit: RequestHandler = (_req, _res, next) => next(),
) {
  const router = Router();

  router.post(
    "/register",
    authRateLimit,
    validate({ body: registerCustomerSchema }),
    asyncHandler(controller.registerCustomer),
  );
  router.post(
    "/login",
    authRateLimit,
    validate({ body: loginSchema }),
    asyncHandler(controller.login),
  );
  router.post("/refresh", authRateLimit, asyncHandler(controller.refresh));
  router.post("/logout", authRateLimit, asyncHandler(controller.logout));
  router.get("/me", authenticateRequest, asyncHandler(controller.me));
  router.post(
    "/users",
    authenticateRequest,
    authorizePermission(permissions.MANAGE_USERS),
    validate({ body: createUserSchema }),
    asyncHandler(controller.createUser),
  );

  return router;
}
