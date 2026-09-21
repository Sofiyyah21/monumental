import jwt from "jsonwebtoken";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { UserRole } from "@prisma/client";
import { createApp } from "../app.js";
import { createFakeDatabase } from "./fake-db.js";

describe("app", () => {
  const app = createApp();

  it("keeps the existing health endpoint working", async () => {
    const response = await request(app).get("/api/v1/health").expect(200);

    expect(response.body).toEqual({
      success: true,
      data: { status: "ok" },
    });
  });

  it("rejects oversized JSON request bodies", async () => {
    const response = await request(app)
      .post("/api/v1/auth/login")
      .send({
        email: "oversized@example.com",
        password: "x".repeat(120_000),
      })
      .expect(413);

    expect(response.body.error.code).toBe("REQUEST_TOO_LARGE");
  });

  it("requires authentication for internal product APIs", async () => {
    const response = await request(app).get("/api/v1/products").expect(401);

    expect(response.body.error.code).toBe("AUTH_REQUIRED");
  });

  it("blocks customer tokens from administrator dashboard APIs", async () => {
    const { db } = createFakeDatabase();
    const appWithFakeDb = createApp(db);
    const user = await db.user.create({
      data: {
        email: "customer@example.com",
        name: "Customer",
        passwordHash: "hashed",
        role: UserRole.CUSTOMER,
      },
    });
    const token = jwt.sign(
      {
        email: "customer@example.com",
        role: UserRole.CUSTOMER,
      },
      process.env.JWT_ACCESS_SECRET!,
      { subject: user.id, expiresIn: "15m" },
    );

    const response = await request(appWithFakeDb)
      .get("/api/v1/reports/dashboard")
      .set("Authorization", `Bearer ${token}`)
      .expect(403);

    expect(response.body.error.code).toBe("FORBIDDEN");
  });
});
