import dotenv from "dotenv";

dotenv.config({ quiet: true });

const fallbackTestDatabaseUrl =
  "postgresql://test:test@localhost:5432/monumental_test";

function withTestDatabaseName(databaseUrl: string) {
  const url = new URL(databaseUrl);
  url.pathname = "/monumental_test";
  return url.toString();
}

process.env.NODE_ENV ??= "test";
process.env.PORT ??= "3000";
if (process.env.RUN_DATABASE_TESTS === "true") {
  process.env.DATABASE_URL =
    process.env.TEST_DATABASE_URL ??
    (process.env.DATABASE_URL
      ? withTestDatabaseName(process.env.DATABASE_URL)
      : fallbackTestDatabaseUrl);
} else {
  process.env.DATABASE_URL =
    process.env.TEST_DATABASE_URL ??
    process.env.DATABASE_URL ??
    fallbackTestDatabaseUrl;
}
process.env.CORS_ORIGIN ??= "http://localhost:5173";
process.env.JWT_ACCESS_SECRET ??=
  "test-access-secret-with-more-than-32-characters";
process.env.JWT_REFRESH_SECRET ??=
  "test-refresh-secret-with-more-than-32-characters";
process.env.ACCESS_TOKEN_EXPIRES_IN ??= "15m";
process.env.REFRESH_TOKEN_EXPIRES_IN_DAYS ??= "30";
process.env.BCRYPT_SALT_ROUNDS = "10";
process.env.BUSINESS_TIMEZONE ??= "Africa/Lagos";
