export type ReportPeriod = "today" | "week" | "month" | "year";
export type ReportDateRange = { start: Date; end: Date };

function getZonedParts(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const parts = Object.fromEntries(
    formatter.formatToParts(date).map((part) => [part.type, part.value]),
  );
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}

function getTimeZoneOffsetMs(date: Date, timeZone: string) {
  const parts = getZonedParts(date, timeZone);
  const utcTime = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  return utcTime - date.getTime();
}

export function zonedDateTimeToUtc(
  timeZone: string,
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0,
) {
  const assumedUtc = new Date(
    Date.UTC(year, month - 1, day, hour, minute, second),
  );
  const offset = getTimeZoneOffsetMs(assumedUtc, timeZone);
  return new Date(assumedUtc.getTime() - offset);
}

export function getReportDateRange(
  period: ReportPeriod,
  now = new Date(),
  timeZone = "Africa/Lagos",
): ReportDateRange {
  const parts = getZonedParts(now, timeZone);
  const zonedTodayUtc = zonedDateTimeToUtc(
    timeZone,
    parts.year,
    parts.month,
    parts.day,
  );
  const zonedToday = getZonedParts(zonedTodayUtc, timeZone);
  const localDate = new Date(
    Date.UTC(zonedToday.year, zonedToday.month - 1, zonedToday.day),
  );

  if (period === "today") {
    const start = zonedDateTimeToUtc(
      timeZone,
      parts.year,
      parts.month,
      parts.day,
    );
    const endDate = new Date(
      Date.UTC(parts.year, parts.month - 1, parts.day + 1),
    );
    return {
      start,
      end: zonedDateTimeToUtc(
        timeZone,
        endDate.getUTCFullYear(),
        endDate.getUTCMonth() + 1,
        endDate.getUTCDate(),
      ),
    };
  }

  if (period === "week") {
    const dayOfWeek = localDate.getUTCDay() || 7;
    const startLocal = new Date(
      Date.UTC(parts.year, parts.month - 1, parts.day - dayOfWeek + 1),
    );
    const endLocal = new Date(
      Date.UTC(
        startLocal.getUTCFullYear(),
        startLocal.getUTCMonth(),
        startLocal.getUTCDate() + 7,
      ),
    );
    return {
      start: zonedDateTimeToUtc(
        timeZone,
        startLocal.getUTCFullYear(),
        startLocal.getUTCMonth() + 1,
        startLocal.getUTCDate(),
      ),
      end: zonedDateTimeToUtc(
        timeZone,
        endLocal.getUTCFullYear(),
        endLocal.getUTCMonth() + 1,
        endLocal.getUTCDate(),
      ),
    };
  }

  if (period === "month") {
    return {
      start: zonedDateTimeToUtc(timeZone, parts.year, parts.month, 1),
      end: zonedDateTimeToUtc(
        timeZone,
        parts.month === 12 ? parts.year + 1 : parts.year,
        parts.month === 12 ? 1 : parts.month + 1,
        1,
      ),
    };
  }

  return {
    start: zonedDateTimeToUtc(timeZone, parts.year, 1, 1),
    end: zonedDateTimeToUtc(timeZone, parts.year + 1, 1, 1),
  };
}

export function getCustomReportDateRange(
  input: { from?: string; to?: string },
  now = new Date(),
  timeZone = "Africa/Lagos",
): ReportDateRange {
  const todayRange = getReportDateRange("today", now, timeZone);
  const start = input.from
    ? parseReportBoundary(input.from, "start", timeZone)
    : todayRange.start;
  const end = input.to
    ? parseReportBoundary(input.to, "end", timeZone)
    : todayRange.end;

  return { start, end };
}

function parseReportBoundary(
  value: string,
  boundary: "start" | "end",
  timeZone: string,
) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number);
    const dayOffset = boundary === "end" ? 1 : 0;
    const localDate = new Date(Date.UTC(year, month - 1, day + dayOffset));
    return zonedDateTimeToUtc(
      timeZone,
      localDate.getUTCFullYear(),
      localDate.getUTCMonth() + 1,
      localDate.getUTCDate(),
    );
  }

  return new Date(value);
}
