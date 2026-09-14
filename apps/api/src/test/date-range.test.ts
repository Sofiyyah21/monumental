import { describe, expect, it } from "vitest";
import { getReportDateRange } from "../lib/date-range.js";

describe("getReportDateRange", () => {
  const now = new Date("2026-09-14T12:00:00.000Z");

  it("uses Lagos day boundaries for today's report", () => {
    const range = getReportDateRange("today", now, "Africa/Lagos");

    expect(range.start.toISOString()).toBe("2026-09-13T23:00:00.000Z");
    expect(range.end.toISOString()).toBe("2026-09-14T23:00:00.000Z");
  });

  it("starts weekly reporting on Monday in the business timezone", () => {
    const range = getReportDateRange("week", now, "Africa/Lagos");

    expect(range.start.toISOString()).toBe("2026-09-13T23:00:00.000Z");
    expect(range.end.toISOString()).toBe("2026-09-20T23:00:00.000Z");
  });
});
