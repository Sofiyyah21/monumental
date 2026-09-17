import { spawnSync } from "node:child_process";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import {
  assertSafeTestDatabaseUrl,
  getTestDatabaseUrl,
} from "./test-database-url.js";

dotenv.config({ quiet: true });

const testDatabaseUrl = getTestDatabaseUrl();
const databaseName = assertSafeTestDatabaseUrl(testDatabaseUrl);

function quotedIdentifier(identifier: string) {
  if (!/^[A-Za-z0-9_-]+$/.test(identifier)) {
    throw new Error(
      `Refusing unsafe test database name "${identifier}". Use letters, numbers, underscores, or hyphens.`,
    );
  }
  return `"${identifier.replaceAll('"', '""')}"`;
}

async function ensureTestDatabaseExists() {
  const adminUrl = new URL(testDatabaseUrl);
  adminUrl.pathname = "/postgres";

  const admin = new PrismaClient({
    datasources: {
      db: { url: adminUrl.toString() },
    },
  });

  try {
    const existingDatabases = await admin.$queryRaw<Array<{ datname: string }>>`
      SELECT datname FROM pg_database WHERE datname = ${databaseName}
    `;
    if (existingDatabases.length === 0) {
      await admin.$executeRawUnsafe(
        `CREATE DATABASE ${quotedIdentifier(databaseName)}`,
      );
    }
  } finally {
    await admin.$disconnect();
  }
}

await ensureTestDatabaseExists();

console.log(`Preparing disposable PostgreSQL test database "${databaseName}".`);

const prismaCommand = process.platform === "win32" ? "prisma.cmd" : "prisma";
const result = spawnSync(
  prismaCommand,
  ["migrate", "reset", "--force", "--skip-seed"],
  {
    env: {
      ...process.env,
      DATABASE_URL: testDatabaseUrl,
      NODE_ENV: "test",
    },
    stdio: "inherit",
  },
);

process.exit(result.status ?? 1);
