import { Router } from "express";
import type { RequestHandler } from "express";
import { OrderController } from "../controllers/order.controller.js";
import { asyncHandler } from "../lib/async-handler.js";
import { authenticate } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import {
  cancelOrderSchema,
  createOrderSchema,
  listOrdersQuerySchema,
  orderIdParamSchema,
} from "../validation/order.schema.js";

export function createOrderRoutes(
  controller: OrderController,
  authenticateRequest: RequestHandler = authenticate,
) {
  const router = Router();

  router.get(
    "/",
    authenticateRequest,
    validate({ query: listOrdersQuerySchema }),
    asyncHandler(controller.list),
  );
  router.post(
    "/:id/cancel",
    authenticateRequest,
    validate({ params: orderIdParamSchema, body: cancelOrderSchema }),
    asyncHandler(controller.cancel),
  );
  router.post(
    "/:id/confirm",
    authenticateRequest,
    validate({ params: orderIdParamSchema }),
    asyncHandler(controller.confirm),
  );
  router.post(
    "/:id/fulfill",
    authenticateRequest,
    validate({ params: orderIdParamSchema }),
    asyncHandler(controller.fulfill),
  );
  router.post(
    "/:id/payment/verify",
    authenticateRequest,
    validate({ params: orderIdParamSchema }),
    asyncHandler(controller.verifyPayment),
  );
  router.get(
    "/:id",
    authenticateRequest,
    validate({ params: orderIdParamSchema }),
    asyncHandler(controller.getById),
  );
  router.post(
    "/",
    authenticateRequest,
    validate({ body: createOrderSchema }),
    asyncHandler(controller.create),
  );

  return router;
}
