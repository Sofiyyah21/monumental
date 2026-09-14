import jwt from "jsonwebtoken";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { UserRole } from "@prisma/client";
import { createApp } from "../app.js";
import { createFakeDatabase } from "./fake-db.js";

const password = "correct-password";

async function createUserThroughDatabase(
  role: UserRole,
  email = `${role.toLowerCase()}@example.com`,
) {
  const fake = createFakeDatabase();
  const app = createApp(fake.db);
  const response = await request(app)
    .post("/api/v1/auth/register")
    .send({ email, name: role, password })
    .expect(201);
  fake.users.get(response.body.data.id)!.role = role;
  return {
    fake,
    app,
    user: response.body.data as {
      id: string;
      email: string;
      name: string;
      role: UserRole;
    },
  };
}

async function login(
  app: ReturnType<typeof createApp>,
  email: string,
  expectedStatus = 200,
) {
  return request(app)
    .post("/api/v1/auth/login")
    .send({ email, password })
    .expect(expectedStatus);
}

describe("authentication and authorization", () => {
  it("registers a customer without returning password fields", async () => {
    const { db } = createFakeDatabase();
    const app = createApp(db);

    const response = await request(app)
      .post("/api/v1/auth/register")
      .send({ email: "customer@example.com", name: "Customer One", password })
      .expect(201);

    expect(response.body.data).toMatchObject({
      email: "customer@example.com",
      name: "Customer One",
      role: UserRole.CUSTOMER,
    });
    expect(JSON.stringify(response.body)).not.toContain("password");
  });

  it("rejects duplicate registration", async () => {
    const { db } = createFakeDatabase();
    const app = createApp(db);

    await request(app)
      .post("/api/v1/auth/register")
      .send({ email: "dupe@example.com", name: "First", password })
      .expect(201);
    const response = await request(app)
      .post("/api/v1/auth/register")
      .send({ email: "dupe@example.com", name: "Second", password })
      .expect(409);

    expect(response.body.error.code).toBe("USER_EXISTS");
  });

  it("logs in with valid credentials and never returns password fields", async () => {
    const { fake, app, user } = await createUserThroughDatabase(
      UserRole.STAFF,
      "staff-login@example.com",
    );
    expect(fake.users.get(user.id)!.passwordHash).not.toBe(password);

    const response = await login(app, user.email);

    expect(response.body.data.user).toMatchObject({
      id: user.id,
      email: user.email,
      role: UserRole.STAFF,
    });
    expect(response.body.data.accessToken).toEqual(expect.any(String));
    expect(response.body.data.refreshToken).toEqual(expect.any(String));
    expect(JSON.stringify(response.body)).not.toContain("passwordHash");
  });

  it("rejects an invalid password", async () => {
    const { app, user } = await createUserThroughDatabase(
      UserRole.STAFF,
      "bad-password@example.com",
    );

    const response = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: user.email, password: "wrong-password" })
      .expect(401);

    expect(response.body.error.code).toBe("INVALID_CREDENTIALS");
  });

  it("returns validation errors for missing credentials", async () => {
    const { db } = createFakeDatabase();
    const app = createApp(db);

    const response = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "missing@example.com" })
      .expect(400);

    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("rejects protected routes without a token", async () => {
    const { db } = createFakeDatabase();
    const app = createApp(db);

    const response = await request(app).get("/api/v1/auth/me").expect(401);

    expect(response.body.error.code).toBe("AUTH_REQUIRED");
  });

  it("allows protected routes with a valid active-user token", async () => {
    const { app, user } = await createUserThroughDatabase(
      UserRole.STAFF,
      "protected@example.com",
    );
    const loginResponse = await login(app, user.email);

    const response = await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${loginResponse.body.data.accessToken}`)
      .expect(200);

    expect(response.body.data).toMatchObject({
      id: user.id,
      role: UserRole.STAFF,
    });
  });

  it("rejects invalid and expired access tokens", async () => {
    const { app, user } = await createUserThroughDatabase(
      UserRole.STAFF,
      "expired@example.com",
    );
    const expiredToken = jwt.sign(
      { email: user.email, role: user.role },
      process.env.JWT_ACCESS_SECRET!,
      {
        subject: user.id,
        expiresIn: "-1s",
      },
    );

    await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", "Bearer not-a-jwt")
      .expect(401);
    const response = await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${expiredToken}`)
      .expect(401);

    expect(response.body.error.code).toBe("INVALID_ACCESS_TOKEN");
  });

  it("refreshes tokens successfully", async () => {
    const { app, user } = await createUserThroughDatabase(
      UserRole.STAFF,
      "refresh@example.com",
    );
    const loginResponse = await login(app, user.email);

    const response = await request(app)
      .post("/api/v1/auth/refresh")
      .send({ refreshToken: loginResponse.body.data.refreshToken })
      .expect(200);

    expect(response.body.data.user.id).toBe(user.id);
    expect(response.body.data.accessToken).toEqual(expect.any(String));
    expect(response.body.data.refreshToken).toEqual(expect.any(String));
    expect(response.body.data.refreshToken).not.toBe(
      loginResponse.body.data.refreshToken,
    );
  });

  it("rotates refresh tokens and blocks reuse of the previous token", async () => {
    const { app, user } = await createUserThroughDatabase(
      UserRole.STAFF,
      "rotate@example.com",
    );
    const loginResponse = await login(app, user.email);
    const firstRefreshToken = loginResponse.body.data.refreshToken;

    const refreshResponse = await request(app)
      .post("/api/v1/auth/refresh")
      .send({ refreshToken: firstRefreshToken })
      .expect(200);

    await request(app)
      .post("/api/v1/auth/refresh")
      .send({ refreshToken: firstRefreshToken })
      .expect(401);
    await request(app)
      .post("/api/v1/auth/refresh")
      .send({ refreshToken: refreshResponse.body.data.refreshToken })
      .expect(200);
  });

  it("rejects revoked refresh tokens after logout", async () => {
    const { app, user } = await createUserThroughDatabase(
      UserRole.STAFF,
      "logout@example.com",
    );
    const loginResponse = await login(app, user.email);
    const refreshToken = loginResponse.body.data.refreshToken;

    await request(app)
      .post("/api/v1/auth/logout")
      .send({ refreshToken })
      .expect(204);
    const response = await request(app)
      .post("/api/v1/auth/refresh")
      .send({ refreshToken })
      .expect(401);

    expect(response.body.error.code).toBe("INVALID_REFRESH_TOKEN");
  });

  it("rejects expired refresh tokens", async () => {
    const { fake, app, user } = await createUserThroughDatabase(
      UserRole.STAFF,
      "expired-refresh@example.com",
    );
    const loginResponse = await login(app, user.email);
    const refreshToken = loginResponse.body.data.refreshToken as string;

    for (const storedRefreshToken of fake.refreshTokens.values()) {
      storedRefreshToken.expiresAt = new Date(Date.now() - 1000);
    }

    const response = await request(app)
      .post("/api/v1/auth/refresh")
      .send({ refreshToken })
      .expect(401);

    expect(response.body.error.code).toBe("INVALID_REFRESH_TOKEN");
  });

  it("allows admin-only user management for admins", async () => {
    const { app, user } = await createUserThroughDatabase(
      UserRole.ADMIN,
      "admin@example.com",
    );
    const loginResponse = await login(app, user.email);

    const response = await request(app)
      .post("/api/v1/auth/users")
      .set("Authorization", `Bearer ${loginResponse.body.data.accessToken}`)
      .send({
        email: "manager-created@example.com",
        name: "Manager",
        password,
        role: UserRole.MANAGER,
      })
      .expect(201);

    expect(response.body.data.role).toBe(UserRole.MANAGER);
  });

  it("allows manager permissions but blocks admin-only permissions", async () => {
    const { app, user } = await createUserThroughDatabase(
      UserRole.MANAGER,
      "manager@example.com",
    );
    const loginResponse = await login(app, user.email);
    const auth = `Bearer ${loginResponse.body.data.accessToken}`;

    await request(app)
      .post("/api/v1/products")
      .set("Authorization", auth)
      .send({
        name: "Manager Drink",
        category: "DRINK",
        costPrice: 100,
        sellingPrice: 150,
        lowStockThreshold: 2,
      })
      .expect(201);
    await request(app)
      .get("/api/v1/reports/summary")
      .set("Authorization", auth)
      .expect(200);
    await request(app)
      .post("/api/v1/auth/users")
      .set("Authorization", auth)
      .send({
        email: "blocked@example.com",
        name: "Blocked",
        password,
        role: UserRole.STAFF,
      })
      .expect(403);
  });

  it("allows staff operational permissions and blocks management permissions", async () => {
    const { app, user } = await createUserThroughDatabase(
      UserRole.STAFF,
      "staff@example.com",
    );
    const loginResponse = await login(app, user.email);
    const auth = `Bearer ${loginResponse.body.data.accessToken}`;

    await request(app)
      .get("/api/v1/products")
      .set("Authorization", auth)
      .expect(200);
    await request(app)
      .get("/api/v1/sales")
      .set("Authorization", auth)
      .expect(200);
    await request(app)
      .post("/api/v1/products")
      .set("Authorization", auth)
      .send({
        name: "Staff Product",
        category: "DRINK",
        costPrice: 100,
        sellingPrice: 150,
      })
      .expect(403);
  });

  it("blocks customers from internal APIs", async () => {
    const { app, user } = await createUserThroughDatabase(
      UserRole.CUSTOMER,
      "customer-restrict@example.com",
    );
    const loginResponse = await login(app, user.email);
    const auth = `Bearer ${loginResponse.body.data.accessToken}`;

    await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", auth)
      .expect(200);
    await request(app)
      .get("/api/v1/products")
      .set("Authorization", auth)
      .expect(403);
    await request(app)
      .get("/api/v1/reports/dashboard")
      .set("Authorization", auth)
      .expect(403);
  });

  it("prevents privilege escalation during customer registration", async () => {
    const { db } = createFakeDatabase();
    const app = createApp(db);

    const response = await request(app)
      .post("/api/v1/auth/register")
      .send({
        email: "escalate@example.com",
        name: "Escalate",
        password,
        role: UserRole.ADMIN,
      })
      .expect(201);

    expect(response.body.data.role).toBe(UserRole.CUSTOMER);
  });

  it("rejects access tokens whose role no longer matches the user record", async () => {
    const { app, user } = await createUserThroughDatabase(
      UserRole.MANAGER,
      "role-mismatch@example.com",
    );
    const forgedAdminToken = jwt.sign(
      { email: user.email, role: UserRole.ADMIN },
      process.env.JWT_ACCESS_SECRET!,
      {
        subject: user.id,
        expiresIn: "15m",
      },
    );

    const response = await request(app)
      .get("/api/v1/reports/dashboard")
      .set("Authorization", `Bearer ${forgedAdminToken}`)
      .expect(401);

    expect(response.body.error.code).toBe("INVALID_ACCESS_TOKEN");
  });
});
