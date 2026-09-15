import type { Request, Response } from "express";
import {
  ReportService,
  type ReportFilters,
} from "../services/report.service.js";
import type { ReportPeriod } from "../lib/date-range.js";

export class ReportController {
  constructor(private readonly reportService: ReportService) {}

  summary = async (req: Request, res: Response) => {
    const result = await this.reportService.getPeriodSummary(
      req.query.period as ReportPeriod,
    );
    res.json({ success: true, data: result });
  };

  periodSummary =
    (period: ReportPeriod) => async (req: Request, res: Response) => {
      const result = await this.reportService.getPeriodSummary(
        period,
        req.query as ReportFilters,
      );
      res.json({ success: true, data: result });
    };

  sales = async (req: Request, res: Response) => {
    const result = await this.reportService.getCustomSalesSummary(
      req.query as ReportFilters,
    );
    res.json({ success: true, data: result });
  };

  productSales = async (req: Request, res: Response) => {
    const result = await this.reportService.getProductSales(
      req.query as ReportFilters,
    );
    res.json({ success: true, data: result });
  };

  bestSellers = async (req: Request, res: Response) => {
    const result = await this.reportService.getBestSellers(
      req.query as ReportFilters,
    );
    res.json({ success: true, data: result });
  };

  lowStock = async (_req: Request, res: Response) => {
    const result = await this.reportService.getLowStockReport();
    res.json({ success: true, data: result });
  };

  inventory = async (_req: Request, res: Response) => {
    const result = await this.reportService.getInventorySummary();
    res.json({ success: true, data: result });
  };

  dashboard = async (_req: Request, res: Response) => {
    const result = await this.reportService.getDashboard();
    res.json({ success: true, data: result });
  };
}
