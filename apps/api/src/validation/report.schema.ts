import { z } from "zod";

export const reportQuerySchema = z.object({
  period: z.enum(["today", "week", "month", "year"]).default("today"),
});
