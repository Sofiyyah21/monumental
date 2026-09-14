import type { Request, Response } from "express";
import { ReportService } from "../services/report.service.js";
import type { ReportPeriod } from "../lib/date-range.js";

export class ReportController {
  constructor(private readonly reportService: ReportService) {}

  summary = async (req: Request, res: Response) => {
    const result = await this.reportService.getPeriodSummary(
      req.query.period as ReportPeriod,
    );
    res.json({ success: true, data: result });
  };

  dashboard = async (_req: Request, res: Response) => {
    const result = await this.reportService.getDashboard();
    res.json({ success: true, data: result });
  };
}
