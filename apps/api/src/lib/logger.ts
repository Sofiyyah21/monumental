type LogFields = Record<string, string | number | boolean | null | undefined>;

function sanitize(fields: LogFields = {}) {
  const sanitized: LogFields = {};
  for (const [key, value] of Object.entries(fields)) {
    if (/password|token|secret|cookie|authorization|database_url/i.test(key)) {
      sanitized[key] = "[REDACTED]";
      continue;
    }
    sanitized[key] = value;
  }
  return sanitized;
}

export const logger = {
  info(message: string, fields?: LogFields) {
    console.info(
      JSON.stringify({ level: "info", message, ...sanitize(fields) }),
    );
  },
  warn(message: string, fields?: LogFields) {
    console.warn(
      JSON.stringify({ level: "warn", message, ...sanitize(fields) }),
    );
  },
  error(message: string, fields?: LogFields) {
    console.error(
      JSON.stringify({ level: "error", message, ...sanitize(fields) }),
    );
  },
};
