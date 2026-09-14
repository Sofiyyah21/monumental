export type ReportPeriod = "today" | "week" | "month" | "year";

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

function zonedDateTimeToUtc(
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
) {
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
