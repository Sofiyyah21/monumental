import { Router } from "express";
import type { RequestHandler } from "express";
import { ReportController } from "../controllers/report.controller.js";
import { permissions } from "../authorization/permissions.js";
import { asyncHandler } from "../lib/async-handler.js";
import { authenticate, authorizePermission } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import {
  bestSellersQuerySchema,
  reportFilterQuerySchema,
  reportQuerySchema,
} from "../validation/report.schema.js";

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
    "/today",
    authenticateRequest,
    authorizePermission(permissions.READ_REPORTS),
    validate({ query: reportFilterQuerySchema }),
    asyncHandler(controller.periodSummary("today")),
  );
  router.get(
    "/week",
    authenticateRequest,
    authorizePermission(permissions.READ_REPORTS),
    validate({ query: reportFilterQuerySchema }),
    asyncHandler(controller.periodSummary("week")),
  );
  router.get(
    "/month",
    authenticateRequest,
    authorizePermission(permissions.READ_REPORTS),
    validate({ query: reportFilterQuerySchema }),
    asyncHandler(controller.periodSummary("month")),
  );
  router.get(
    "/year",
    authenticateRequest,
    authorizePermission(permissions.READ_REPORTS),
    validate({ query: reportFilterQuerySchema }),
    asyncHandler(controller.periodSummary("year")),
  );
  router.get(
    "/sales",
    authenticateRequest,
    authorizePermission(permissions.READ_REPORTS),
    validate({ query: reportFilterQuerySchema }),
    asyncHandler(controller.sales),
  );
  router.get(
    "/products",
    authenticateRequest,
    authorizePermission(permissions.READ_REPORTS),
    validate({ query: reportFilterQuerySchema }),
    asyncHandler(controller.productSales),
  );
  router.get(
    "/best-sellers",
    authenticateRequest,
    authorizePermission(permissions.READ_REPORTS),
    validate({ query: bestSellersQuerySchema }),
    asyncHandler(controller.bestSellers),
  );
  router.get(
    "/low-stock",
    authenticateRequest,
    authorizePermission(permissions.READ_REPORTS),
    asyncHandler(controller.lowStock),
  );
  router.get(
    "/inventory",
    authenticateRequest,
    authorizePermission(permissions.READ_REPORTS),
    asyncHandler(controller.inventory),
  );
  router.get(
    "/dashboard",
    authenticateRequest,
    authorizePermission(permissions.READ_ADMIN_DASHBOARD),
    asyncHandler(controller.dashboard),
  );

  return router;
}
