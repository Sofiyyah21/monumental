import crypto from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Prisma, ProductCategory, ProductUnit } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { ProductService } from "../services/product.service.js";

const runDatabaseTests = process.env.RUN_DATABASE_TESTS === "true";
const describeDatabase = runDatabaseTests ? describe : describe.skip;
const testSkuPrefix = "PRODUCT-INTEGRATION";

function assertSafeTestDatabase() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required for product integration tests.");
  }

  const databaseName = new URL(databaseUrl).pathname.replace("/", "");
  if (!databaseName.toLowerCase().includes("test")) {
    throw new Error(
      "Product integration tests require a dedicated test database name containing 'test'.",
    );
  }
}

function uniqueSku(prefix: string) {
  return `${testSkuPrefix}-${prefix}-${crypto.randomUUID()}`.toUpperCase();
}

async function cleanupIntegrationProducts() {
  await prisma.product.deleteMany({
    where: { sku: { startsWith: testSkuPrefix } },
  });
}

describeDatabase("database-backed product catalog integration", () => {
  const productService = new ProductService(prisma);

  beforeAll(async () => {
    assertSafeTestDatabase();
    await prisma.$connect();
    await cleanupIntegrationProducts();
  });

  afterAll(async () => {
    await cleanupIntegrationProducts();
    await prisma.$disconnect();
  });

  it("enforces unique product SKUs in PostgreSQL", async () => {
    const sku = uniqueSku("UNIQUE");

    await productService.create({
      name: "Integration Drink",
      sku,
      category: ProductCategory.DRINKS,
      unit: ProductUnit.PACK,
      costPrice: 100,
      sellingPrice: 120,
      reorderLevel: 3,
    });

    await expect(
      productService.create({
        name: "Integration Drink With Duplicate SKU",
        sku,
        category: ProductCategory.DRINKS,
        unit: ProductUnit.PACK,
        costPrice: 100,
        sellingPrice: 120,
        reorderLevel: 3,
      }),
    ).rejects.toMatchObject({ statusCode: 409, code: "PRODUCT_SKU_EXISTS" });
  });

  it("stores money and reorder levels as decimals without floating point columns", async () => {
    const product = await productService.create({
      name: "Integration Sugar",
      sku: uniqueSku("DECIMAL"),
      category: ProductCategory.SUGAR,
      unit: ProductUnit.CUP,
      costPrice: 10.25,
      sellingPrice: 12.5,
      reorderLevel: 7.5,
    });

    expect(product.costPrice).toBeInstanceOf(Prisma.Decimal);
    expect(product.sellingPrice).toBeInstanceOf(Prisma.Decimal);
    expect(product.reorderLevel).toBeInstanceOf(Prisma.Decimal);
    expect(product.costPrice.toFixed(2)).toBe("10.25");
    expect(product.sellingPrice.toFixed(2)).toBe("12.50");
    expect(product.reorderLevel.toFixed(3)).toBe("7.500");
  });

  it("rejects category and unit combinations that do not match the business rules", async () => {
    await expect(
      prisma.product.create({
        data: {
          name: "Invalid Oil",
          sku: uniqueSku("BAD-UNIT"),
          category: ProductCategory.VEGETABLE_OIL,
          unit: ProductUnit.CUP,
          costPrice: new Prisma.Decimal(100),
          sellingPrice: new Prisma.Decimal(110),
          reorderLevel: new Prisma.Decimal(2),
        },
      }),
    ).rejects.toThrow();
  });
});
