import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { UserRole } from "@prisma/client";
import { createApp } from "../app.js";
import {
  permissions,
  roleHasPermission,
} from "../authorization/permissions.js";
import { bootstrapFirstAdmin } from "../bootstrap/first-admin.js";
import { prisma } from "../lib/prisma.js";
import { AuthService } from "../services/auth.service.js";

const runDatabaseTests = process.env.RUN_DATABASE_TESTS === "true";
const describeDatabase = runDatabaseTests ? describe : describe.skip;
const testEmailDomain = "auth-integration.test";
const password = "database-test-password";

function assertSafeTestDatabase() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required for auth integration tests.");
  }

  const databaseName = new URL(databaseUrl).pathname.replace("/", "");
  if (!databaseName.toLowerCase().includes("test")) {
    throw new Error(
      "Auth integration tests require a dedicated test database name containing 'test'.",
    );
  }
}

function uniqueEmail(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}@${testEmailDomain}`;
}

async function cleanupIntegrationUsers() {
  await prisma.refreshToken.deleteMany({
    where: { user: { email: { endsWith: `@${testEmailDomain}` } } },
  });
  await prisma.user.deleteMany({
    where: { email: { endsWith: `@${testEmailDomain}` } },
  });
}

async function createUser(
  role: UserRole,
  email = uniqueEmail(role.toLowerCase()),
) {
  const authService = new AuthService(prisma);
  const user = await authService.createUser({
    email,
    name: `${role} Integration`,
    password,
    role,
  });
  return user;
}

async function login(app: ReturnType<typeof createApp>, email: string) {
  return request(app)
    .post("/api/v1/auth/login")
    .send({ email, password })
    .expect(200);
}

describeDatabase("database-backed authentication integration", () => {
  const app = createApp(prisma);

  beforeAll(async () => {
    assertSafeTestDatabase();
    await prisma.$connect();
    await cleanupIntegrationUsers();
    const existingAdminCount = await prisma.user.count({
      where: { role: UserRole.ADMIN },
    });
    if (existingAdminCount > 0) {
      throw new Error(
        "Auth integration tests require a dedicated test database without pre-existing admin users.",
      );
    }
  });

  afterAll(async () => {
    await cleanupIntegrationUsers();
    await prisma.$disconnect();
  });

  it("bootstraps the first admin once with a hashed password", async () => {
    const bootstrapPassword = "bootstrap-database-password";
    const email = uniqueEmail("bootstrap");

    const result = await bootstrapFirstAdmin(prisma, {
      BOOTSTRAP_ADMIN_EMAIL: email,
      BOOTSTRAP_ADMIN_NAME: "Bootstrap Admin",
      BOOTSTRAP_ADMIN_PASSWORD: bootstrapPassword,
      BCRYPT_SALT_ROUNDS: 10,
    });

    expect(result.status).toBe("created");

    const storedAdmin = await prisma.user.findUniqueOrThrow({
      where: { email },
    });
    expect(storedAdmin.role).toBe(UserRole.ADMIN);
    expect(storedAdmin.passwordHash).not.toBe(bootstrapPassword);
    await expect(
      bcrypt.compare(bootstrapPassword, storedAdmin.passwordHash),
    ).resolves.toBe(true);

    const secondResult = await bootstrapFirstAdmin(prisma, {
      BOOTSTRAP_ADMIN_EMAIL: uniqueEmail("bootstrap-second"),
      BOOTSTRAP_ADMIN_NAME: "Second Bootstrap Admin",
      BOOTSTRAP_ADMIN_PASSWORD: "another-bootstrap-password",
      BCRYPT_SALT_ROUNDS: 10,
    });

    expect(secondResult).toEqual({ status: "skipped", reason: "admin_exists" });

    const adminCount = await prisma.user.count({
      where: { role: UserRole.ADMIN },
    });
    expect(adminCount).toBe(1);
  });

  it("creates users with hashed passwords and never returns password fields", async () => {
    const user = await createUser(UserRole.STAFF, uniqueEmail("create"));
    const storedUser = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
    });

    expect(storedUser.passwordHash).not.toBe(password);
    await expect(
      bcrypt.compare(password, storedUser.passwordHash),
    ).resolves.toBe(true);
    expect(JSON.stringify(user)).not.toContain("password");
  });

  it("registers customers only, ignoring privilege escalation input", async () => {
    const response = await request(app)
      .post("/api/v1/auth/register")
      .send({
        email: uniqueEmail("register"),
        name: "Register Integration",
        password,
        role: UserRole.ADMIN,
      })
      .expect(201);

    expect(response.body.data.role).toBe(UserRole.CUSTOMER);
    expect(JSON.stringify(response.body)).not.toContain("passwordHash");
  });

  it("logs in, creates a refresh token, and authenticates access tokens against the database", async () => {
    const user = await createUser(UserRole.STAFF, uniqueEmail("login"));
    const loginResponse = await login(app, user.email);

    const refreshTokenCount = await prisma.refreshToken.count({
      where: { userId: user.id, revokedAt: null },
    });
    expect(refreshTokenCount).toBe(1);

    const meResponse = await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${loginResponse.body.data.accessToken}`)
      .expect(200);

    expect(meResponse.body.data).toMatchObject({
      id: user.id,
      email: user.email,
      role: UserRole.STAFF,
    });
  });

  it("rotates refresh tokens and rejects revoked refresh tokens", async () => {
    const user = await createUser(UserRole.STAFF, uniqueEmail("rotate"));
    const loginResponse = await login(app, user.email);
    const originalRefreshToken = loginResponse.body.data.refreshToken as string;

    const refreshResponse = await request(app)
      .post("/api/v1/auth/refresh")
      .send({ refreshToken: originalRefreshToken })
      .expect(200);

    expect(refreshResponse.body.data.refreshToken).not.toBe(
      originalRefreshToken,
    );

    const revokedCount = await prisma.refreshToken.count({
      where: { userId: user.id, revokedAt: { not: null } },
    });
    const activeCount = await prisma.refreshToken.count({
      where: { userId: user.id, revokedAt: null },
    });
    expect(revokedCount).toBe(1);
    expect(activeCount).toBe(1);

    const rejectedResponse = await request(app)
      .post("/api/v1/auth/refresh")
      .send({ refreshToken: originalRefreshToken })
      .expect(401);

    expect(rejectedResponse.body.error.code).toBe("INVALID_REFRESH_TOKEN");
  });

  it("revokes refresh tokens on logout and rejects reuse", async () => {
    const user = await createUser(UserRole.STAFF, uniqueEmail("logout"));
    const loginResponse = await login(app, user.email);
    const refreshToken = loginResponse.body.data.refreshToken as string;

    await request(app)
      .post("/api/v1/auth/logout")
      .send({ refreshToken })
      .expect(204);

    await expect(
      prisma.refreshToken.count({
        where: { userId: user.id, revokedAt: null },
      }),
    ).resolves.toBe(0);

    const response = await request(app)
      .post("/api/v1/auth/refresh")
      .send({ refreshToken })
      .expect(401);
    expect(response.body.error.code).toBe("INVALID_REFRESH_TOKEN");
  });

  it("rejects expired refresh tokens", async () => {
    const user = await createUser(
      UserRole.STAFF,
      uniqueEmail("expired-refresh"),
    );
    const loginResponse = await login(app, user.email);
    const refreshToken = loginResponse.body.data.refreshToken as string;

    await prisma.refreshToken.updateMany({
      where: { userId: user.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    const response = await request(app)
      .post("/api/v1/auth/refresh")
      .send({ refreshToken })
      .expect(401);
    expect(response.body.error.code).toBe("INVALID_REFRESH_TOKEN");
  });

  it("blocks inactive users from login and access-token authentication", async () => {
    const user = await createUser(UserRole.STAFF, uniqueEmail("inactive"));
    const loginResponse = await login(app, user.email);

    await prisma.user.update({
      where: { id: user.id },
      data: { active: false },
    });

    await request(app)
      .post("/api/v1/auth/login")
      .send({ email: user.email, password })
      .expect(401);
    const response = await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${loginResponse.body.data.accessToken}`)
      .expect(401);

    expect(response.body.error.code).toBe("INVALID_ACCESS_TOKEN");
  });

  it("uses current database role when authorizing access tokens", async () => {
    const user = await createUser(UserRole.MANAGER, uniqueEmail("role-change"));
    const loginResponse = await login(app, user.email);

    await prisma.user.update({
      where: { id: user.id },
      data: { role: UserRole.STAFF },
    });

    const response = await request(app)
      .get("/api/v1/reports/summary")
      .set("Authorization", `Bearer ${loginResponse.body.data.accessToken}`)
      .expect(401);

    expect(response.body.error.code).toBe("INVALID_ACCESS_TOKEN");
  });

  it("enforces role authorization through protected HTTP routes", async () => {
    const admin = await createUser(UserRole.ADMIN, uniqueEmail("admin"));
    const manager = await createUser(UserRole.MANAGER, uniqueEmail("manager"));
    const staff = await createUser(UserRole.STAFF, uniqueEmail("staff"));
    const customer = await createUser(
      UserRole.CUSTOMER,
      uniqueEmail("customer"),
    );

    const adminAuth = `Bearer ${(await login(app, admin.email)).body.data.accessToken}`;
    const managerAuth = `Bearer ${(await login(app, manager.email)).body.data.accessToken}`;
    const staffAuth = `Bearer ${(await login(app, staff.email)).body.data.accessToken}`;
    const customerAuth = `Bearer ${(await login(app, customer.email)).body.data.accessToken}`;

    await request(app)
      .get("/api/v1/reports/dashboard")
      .set("Authorization", adminAuth)
      .expect(200);
    await request(app)
      .get("/api/v1/reports/summary")
      .set("Authorization", managerAuth)
      .expect(200);
    await request(app)
      .get("/api/v1/products")
      .set("Authorization", staffAuth)
      .expect(200);
    await request(app)
      .get("/api/v1/products")
      .set("Authorization", customerAuth)
      .expect(403);
    await request(app)
      .post("/api/v1/auth/users")
      .set("Authorization", managerAuth)
      .send({
        email: uniqueEmail("manager-escalation"),
        name: "Blocked",
        password,
        role: UserRole.ADMIN,
      })
      .expect(403);
  });

  it("keeps the admin role as the authorization override", () => {
    for (const permission of Object.values(permissions)) {
      expect(roleHasPermission(UserRole.ADMIN, permission)).toBe(true);
    }
  });
});
