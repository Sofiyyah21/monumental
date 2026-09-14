import { Router } from "express";
import type { RequestHandler } from "express";
import { ReportController } from "../controllers/report.controller.js";
import { permissions } from "../authorization/permissions.js";
import { asyncHandler } from "../lib/async-handler.js";
import { authenticate, authorizePermission } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { reportQuerySchema } from "../validation/report.schema.js";

export function createReportRoutes(
  controller: ReportController,
  authenticateRequest: RequestHandler = authenticate,
) {
  const router = Router();

  router.get(
    "/summary",
    authenticateRequest,
    authorizePermission(permissions.READ_REPORTS),
    validate({ query: reportQuerySchema }),
    asyncHandler(controller.summary),
  );
  router.get(
    "/dashboard",
    authenticateRequest,
    authorizePermission(permissions.READ_ADMIN_DASHBOARD),
    asyncHandler(controller.dashboard),
  );

  return router;
}
