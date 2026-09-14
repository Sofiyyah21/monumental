import jwt from "jsonwebtoken";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { ProductCategory, ProductUnit, UserRole } from "@prisma/client";
import { createApp } from "../app.js";
import type { DatabaseClient } from "../lib/database.js";
import { createFakeDatabase } from "./fake-db.js";

const validProduct = {
  name: "Monumental Drink Pack",
  sku: "DRINK-PACK-001",
  category: ProductCategory.DRINKS,
  unit: ProductUnit.PACK,
  costPrice: 100,
  sellingPrice: 150,
  reorderLevel: 5,
};

let userSequence = 1;

function createProductTestContext() {
  const { db } = createFakeDatabase();
  const app = createApp(db);
  return { app, db };
}

async function createAuth(db: DatabaseClient, role: UserRole) {
  const userNumber = userSequence;
  userSequence += 1;
  const user = await db.user.create({
    data: {
      email: `${role.toLowerCase()}-${userNumber}@products.test`,
      name: `${role} Products`,
      passwordHash: "hashed",
      role,
    },
  });
  const accessToken = jwt.sign(
    { email: user.email, role },
    process.env.JWT_ACCESS_SECRET!,
    {
      subject: user.id,
      expiresIn: "15m",
    },
  );

  return `Bearer ${accessToken}`;
}

describe("product catalog API", () => {
  it("creates a valid product as an admin", async () => {
    const { app, db } = createProductTestContext();
    const auth = await createAuth(db, UserRole.ADMIN);

    const response = await request(app)
      .post("/api/v1/products")
      .set("Authorization", auth)
      .send(validProduct)
      .expect(201);

    expect(response.body.data).toMatchObject({
      name: validProduct.name,
      sku: validProduct.sku,
      category: ProductCategory.DRINKS,
      unit: ProductUnit.PACK,
      active: true,
    });
    expect(Number(response.body.data.costPrice)).toBe(validProduct.costPrice);
    expect(Number(response.body.data.sellingPrice)).toBe(
      validProduct.sellingPrice,
    );
    expect(Number(response.body.data.reorderLevel)).toBe(
      validProduct.reorderLevel,
    );
  });

  it("rejects invalid product categories and units", async () => {
    const { app, db } = createProductTestContext();
    const auth = await createAuth(db, UserRole.MANAGER);

    await request(app)
      .post("/api/v1/products")
      .set("Authorization", auth)
      .send({ ...validProduct, category: "DRINK", sku: "BAD-CATEGORY" })
      .expect(400);

    await request(app)
      .post("/api/v1/products")
      .set("Authorization", auth)
      .send({ ...validProduct, unit: "PKT", sku: "BAD-UNIT" })
      .expect(400);

    const mismatchResponse = await request(app)
      .post("/api/v1/products")
      .set("Authorization", auth)
      .send({
        ...validProduct,
        category: ProductCategory.VEGETABLE_OIL,
        unit: ProductUnit.CUP,
        sku: "BAD-COMBO",
      })
      .expect(400);
    expect(mismatchResponse.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("rejects negative product values", async () => {
    const { app, db } = createProductTestContext();
    const auth = await createAuth(db, UserRole.MANAGER);

    await request(app)
      .post("/api/v1/products")
      .set("Authorization", auth)
      .send({ ...validProduct, costPrice: -1, sku: "BAD-COST" })
      .expect(400);

    await request(app)
      .post("/api/v1/products")
      .set("Authorization", auth)
      .send({ ...validProduct, sellingPrice: -1, sku: "BAD-SELLING" })
      .expect(400);

    await request(app)
      .post("/api/v1/products")
      .set("Authorization", auth)
      .send({ ...validProduct, reorderLevel: -1, sku: "BAD-REORDER" })
      .expect(400);
  });

  it("rejects duplicate SKUs", async () => {
    const { app, db } = createProductTestContext();
    const auth = await createAuth(db, UserRole.MANAGER);

    await request(app)
      .post("/api/v1/products")
      .set("Authorization", auth)
      .send(validProduct)
      .expect(201);
    const response = await request(app)
      .post("/api/v1/products")
      .set("Authorization", auth)
      .send({ ...validProduct, name: "Another Drink Name" })
      .expect(409);

    expect(response.body.error.code).toBe("PRODUCT_SKU_EXISTS");
  });

  it("enforces product creation authorization", async () => {
    const { app, db } = createProductTestContext();
    const staffAuth = await createAuth(db, UserRole.STAFF);
    const customerAuth = await createAuth(db, UserRole.CUSTOMER);

    await request(app)
      .post("/api/v1/products")
      .set("Authorization", staffAuth)
      .send(validProduct)
      .expect(403);

    await request(app)
      .post("/api/v1/products")
      .set("Authorization", customerAuth)
      .send(validProduct)
      .expect(403);
  });

  it("allows managers to create products", async () => {
    const { app, db } = createProductTestContext();
    const auth = await createAuth(db, UserRole.MANAGER);

    await request(app)
      .post("/api/v1/products")
      .set("Authorization", auth)
      .send(validProduct)
      .expect(201);
  });

  it("gets products by id and returns 404 for missing products", async () => {
    const { app, db } = createProductTestContext();
    const staffAuth = await createAuth(db, UserRole.STAFF);
    const managerAuth = await createAuth(db, UserRole.MANAGER);
    const createResponse = await request(app)
      .post("/api/v1/products")
      .set("Authorization", managerAuth)
      .send(validProduct)
      .expect(201);

    const getResponse = await request(app)
      .get(`/api/v1/products/${createResponse.body.data.id}`)
      .set("Authorization", staffAuth)
      .expect(200);

    expect(getResponse.body.data.sku).toBe(validProduct.sku);

    await request(app)
      .get("/api/v1/products/missing")
      .set("Authorization", staffAuth)
      .expect(404);
  });

  it("lists products with filters for staff and blocks customers", async () => {
    const { app, db } = createProductTestContext();
    const managerAuth = await createAuth(db, UserRole.MANAGER);
    const staffAuth = await createAuth(db, UserRole.STAFF);
    const customerAuth = await createAuth(db, UserRole.CUSTOMER);

    await request(app)
      .post("/api/v1/products")
      .set("Authorization", managerAuth)
      .send(validProduct)
      .expect(201);
    await request(app)
      .post("/api/v1/products")
      .set("Authorization", managerAuth)
      .send({
        name: "Monumental Sugar Cup",
        sku: "SUGAR-CUP-001",
        category: ProductCategory.SUGAR,
        unit: ProductUnit.CUP,
        costPrice: 50,
        sellingPrice: 75,
        reorderLevel: 10,
      })
      .expect(201);

    const listResponse = await request(app)
      .get("/api/v1/products")
      .query({ category: ProductCategory.SUGAR, unit: ProductUnit.CUP })
      .set("Authorization", staffAuth)
      .expect(200);

    expect(listResponse.body.data).toHaveLength(1);
    expect(listResponse.body.data[0].sku).toBe("SUGAR-CUP-001");

    const searchResponse = await request(app)
      .get("/api/v1/products")
      .query({ search: "drink" })
      .set("Authorization", staffAuth)
      .expect(200);

    expect(searchResponse.body.data).toHaveLength(1);
    expect(searchResponse.body.data[0].sku).toBe(validProduct.sku);

    await request(app)
      .get("/api/v1/products")
      .set("Authorization", customerAuth)
      .expect(403);
  });

  it("updates products as managers and admins while rejecting invalid updates", async () => {
    const { app, db } = createProductTestContext();
    const managerAuth = await createAuth(db, UserRole.MANAGER);
    const adminAuth = await createAuth(db, UserRole.ADMIN);
    const createResponse = await request(app)
      .post("/api/v1/products")
      .set("Authorization", managerAuth)
      .send(validProduct)
      .expect(201);

    const updateResponse = await request(app)
      .patch(`/api/v1/products/${createResponse.body.data.id}`)
      .set("Authorization", managerAuth)
      .send({ name: "Updated Drink", sellingPrice: 140 })
      .expect(200);

    expect(updateResponse.body.data.name).toBe("Updated Drink");
    expect(Number(updateResponse.body.data.sellingPrice)).toBe(140);

    await request(app)
      .patch(`/api/v1/products/${createResponse.body.data.id}`)
      .set("Authorization", managerAuth)
      .send({ category: ProductCategory.SUGAR, unit: ProductUnit.LITER })
      .expect(400);

    await request(app)
      .patch(`/api/v1/products/${createResponse.body.data.id}`)
      .set("Authorization", adminAuth)
      .send({ sku: "UPDATED-DRINK" })
      .expect(200);
  });

  it("rejects unauthorized product updates", async () => {
    const { app, db } = createProductTestContext();
    const managerAuth = await createAuth(db, UserRole.MANAGER);
    const staffAuth = await createAuth(db, UserRole.STAFF);
    const createResponse = await request(app)
      .post("/api/v1/products")
      .set("Authorization", managerAuth)
      .send(validProduct)
      .expect(201);

    await request(app)
      .patch(`/api/v1/products/${createResponse.body.data.id}`)
      .set("Authorization", staffAuth)
      .send({ name: "Blocked Update" })
      .expect(403);
  });

  it("deactivates products without deleting them", async () => {
    const { app, db } = createProductTestContext();
    const auth = await createAuth(db, UserRole.ADMIN);
    const createResponse = await request(app)
      .post("/api/v1/products")
      .set("Authorization", auth)
      .send(validProduct)
      .expect(201);

    const deactivateResponse = await request(app)
      .patch(`/api/v1/products/${createResponse.body.data.id}/deactivate`)
      .set("Authorization", auth)
      .expect(200);

    expect(deactivateResponse.body.data.active).toBe(false);

    await request(app)
      .patch("/api/v1/products/missing/deactivate")
      .set("Authorization", auth)
      .expect(404);
  });

  it("rejects unauthorized product deactivation", async () => {
    const { app, db } = createProductTestContext();
    const managerAuth = await createAuth(db, UserRole.MANAGER);
    const customerAuth = await createAuth(db, UserRole.CUSTOMER);
    const createResponse = await request(app)
      .post("/api/v1/products")
      .set("Authorization", managerAuth)
      .send(validProduct)
      .expect(201);

    await request(app)
      .patch(`/api/v1/products/${createResponse.body.data.id}/deactivate`)
      .set("Authorization", customerAuth)
      .expect(403);
  });
});
