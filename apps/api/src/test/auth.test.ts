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

function getRefreshCookie(response: request.Response) {
  const cookies = response.headers["set-cookie"];
  const cookieList = Array.isArray(cookies)
    ? cookies
    : [cookies].filter(Boolean);
  const refreshCookie = cookieList.find((cookie) =>
    cookie.startsWith("md_refresh_token="),
  );
  expect(refreshCookie).toEqual(expect.any(String));
  return refreshCookie!;
}

function expectRefreshCookieAttributes(response: request.Response) {
  const refreshCookie = getRefreshCookie(response);
  expect(refreshCookie).toContain("HttpOnly");
  expect(refreshCookie).toContain("Path=/api/v1/auth");
  expect(refreshCookie).toContain("SameSite=Lax");
  expect(refreshCookie).not.toContain("Secure");
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

  it("logs in with valid credentials, sets a refresh cookie, and never returns password or refresh-token fields", async () => {
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
    expect(response.body.data.refreshToken).toBeUndefined();
    expect(JSON.stringify(response.body)).not.toContain("passwordHash");
    expectRefreshCookieAttributes(response);
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
    const refreshCookie = getRefreshCookie(loginResponse);

    const response = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", refreshCookie)
      .expect(200);

    expect(response.body.data.user.id).toBe(user.id);
    expect(response.body.data.accessToken).toEqual(expect.any(String));
    expect(response.body.data.refreshToken).toBeUndefined();
    expect(getRefreshCookie(response)).not.toBe(refreshCookie);
  });

  it("rejects refresh requests without the HttpOnly cookie even when a JSON body is provided", async () => {
    const { app, user } = await createUserThroughDatabase(
      UserRole.STAFF,
      "refresh-body@example.com",
    );
    await login(app, user.email);

    const response = await request(app)
      .post("/api/v1/auth/refresh")
      .send({ refreshToken: "client-readable-token-is-not-accepted" })
      .expect(401);

    expect(response.body.error.code).toBe("INVALID_REFRESH_TOKEN");
  });

  it("rotates refresh tokens and blocks reuse of the previous token", async () => {
    const { app, user } = await createUserThroughDatabase(
      UserRole.STAFF,
      "rotate@example.com",
    );
    const loginResponse = await login(app, user.email);
    const firstRefreshCookie = getRefreshCookie(loginResponse);

    const refreshResponse = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", firstRefreshCookie)
      .expect(200);
    const secondRefreshCookie = getRefreshCookie(refreshResponse);

    await request(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", firstRefreshCookie)
      .expect(401);
    await request(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", secondRefreshCookie)
      .expect(200);
  });

  it("rejects revoked refresh tokens after logout", async () => {
    const { app, user } = await createUserThroughDatabase(
      UserRole.STAFF,
      "logout@example.com",
    );
    const loginResponse = await login(app, user.email);
    const refreshCookie = getRefreshCookie(loginResponse);

    await request(app)
      .post("/api/v1/auth/logout")
      .set("Cookie", refreshCookie)
      .expect(204)
      .expect((response) => {
        const clearedCookie = getRefreshCookie(response);
        expect(clearedCookie).toContain("Expires=Thu, 01 Jan 1970");
      });
    const response = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", refreshCookie)
      .expect(401);

    expect(response.body.error.code).toBe("INVALID_REFRESH_TOKEN");
  });

  it("clears the refresh cookie during logout even if no cookie is present", async () => {
    const { db } = createFakeDatabase();
    const app = createApp(db);

    await request(app)
      .post("/api/v1/auth/logout")
      .expect(204)
      .expect((response) => {
        const clearedCookie = getRefreshCookie(response);
        expect(clearedCookie).toContain("Expires=Thu, 01 Jan 1970");
      });
  });

  it("rejects expired refresh tokens", async () => {
    const { fake, app, user } = await createUserThroughDatabase(
      UserRole.STAFF,
      "expired-refresh@example.com",
    );
    const loginResponse = await login(app, user.email);
    const refreshCookie = getRefreshCookie(loginResponse);

    for (const storedRefreshToken of fake.refreshTokens.values()) {
      storedRefreshToken.expiresAt = new Date(Date.now() - 1000);
    }

    const response = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", refreshCookie)
      .expect(401);

    expect(response.body.error.code).toBe("INVALID_REFRESH_TOKEN");
  });

  it("rejects invalid refresh cookies and untrusted cookie origins", async () => {
    const { db } = createFakeDatabase();
    const app = createApp(db);

    await request(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", "md_refresh_token=invalid")
      .expect(401);

    const response = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Origin", "https://evil.example")
      .set("Cookie", "md_refresh_token=invalid")
      .expect(403);
    expect(response.body.error.code).toBe("CORS_DENIED");
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
        sku: "MANAGER-DRINK",
        category: "DRINKS",
        unit: "PACK",
        costPrice: 100,
        sellingPrice: 150,
        reorderLevel: 2,
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
        sku: "STAFF-PRODUCT",
        category: "DRINKS",
        unit: "PACK",
        costPrice: 100,
        sellingPrice: 150,
      })
      .expect(403);
  });

  it("keeps customers out of internal APIs while allowing the customer catalog", async () => {
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
      .expect(200);
    await request(app)
      .post("/api/v1/products")
      .set("Authorization", auth)
      .send({
        name: "Customer Product",
        sku: "CUSTOMER-PRODUCT",
        category: "DRINKS",
        unit: "PACK",
        costPrice: 100,
        sellingPrice: 150,
      })
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
