export const fallbackTestDatabaseUrl =
  "postgresql://test:test@localhost:5432/monumental_test";

export function withTestDatabaseName(databaseUrl: string) {
  const url = new URL(databaseUrl);
  url.pathname = "/monumental_test";
  return url.toString();
}

export function getTestDatabaseUrl(env: NodeJS.ProcessEnv = process.env) {
  return (
    env.TEST_DATABASE_URL ??
    (env.DATABASE_URL
      ? withTestDatabaseName(env.DATABASE_URL)
      : fallbackTestDatabaseUrl)
  );
}

export function assertSafeTestDatabaseUrl(databaseUrl: string) {
  const databaseName = new URL(databaseUrl).pathname.replace("/", "");
  if (!databaseName.toLowerCase().includes("test")) {
    throw new Error(
      `Refusing to prepare non-test database "${databaseName}". The integration test database name must contain "test".`,
    );
  }
  return databaseName;
}
