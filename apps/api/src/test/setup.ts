import dotenv from "dotenv";
import {
  fallbackTestDatabaseUrl,
  getTestDatabaseUrl,
} from "./test-database-url.js";

dotenv.config({ quiet: true });

process.env.NODE_ENV ??= "test";
process.env.PORT ??= "3000";
if (process.env.RUN_DATABASE_TESTS === "true") {
  process.env.DATABASE_URL = getTestDatabaseUrl();
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
