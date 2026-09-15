import crypto from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  Prisma,
  ProductCategory,
  ProductUnit,
  StockMovementType,
  UserRole,
} from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { InventoryService } from "../services/inventory.service.js";

const runDatabaseTests = process.env.RUN_DATABASE_TESTS === "true";
const describeDatabase = runDatabaseTests ? describe : describe.skip;
const testSkuPrefix = "INVENTORY-INTEGRATION";

function assertSafeTestDatabase() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL is required for inventory integration tests.",
    );
  }

  const databaseName = new URL(databaseUrl).pathname.replace("/", "");
  if (!databaseName.toLowerCase().includes("test")) {
    throw new Error(
      "Inventory integration tests require a dedicated test database name containing 'test'.",
    );
  }
}

function uniqueSku(prefix: string) {
  return `${testSkuPrefix}-${prefix}-${crypto.randomUUID()}`.toUpperCase();
}

async function cleanupIntegrationInventory() {
  await prisma.stockMovement.deleteMany({
    where: { product: { sku: { startsWith: testSkuPrefix } } },
  });
  await prisma.product.deleteMany({
    where: { sku: { startsWith: testSkuPrefix } },
  });
  await prisma.user.deleteMany({
    where: { email: { endsWith: "@inventory-integration.test" } },
  });
}

async function createUser() {
  return prisma.user.create({
    data: {
      email: `inventory-${crypto.randomUUID()}@inventory-integration.test`,
      name: "Inventory Integration User",
      passwordHash: "hashed",
      role: UserRole.MANAGER,
    },
  });
}

async function createProduct(input: { reorderLevel?: number } = {}) {
  return prisma.product.create({
    data: {
      name: `Inventory Integration Product ${crypto.randomUUID()}`,
      sku: uniqueSku("PRODUCT"),
      category: ProductCategory.DRINKS,
      unit: ProductUnit.PACK,
      costPrice: new Prisma.Decimal(100),
      sellingPrice: new Prisma.Decimal(150),
      reorderLevel: new Prisma.Decimal(input.reorderLevel ?? 5),
    },
  });
}

describeDatabase("database-backed inventory integration", () => {
  const inventoryService = new InventoryService(prisma);

  beforeAll(async () => {
    assertSafeTestDatabase();
    await prisma.$connect();
    await cleanupIntegrationInventory();
  });

  afterAll(async () => {
    await cleanupIntegrationInventory();
    await prisma.$disconnect();
  });

  it("keeps currentStock and stock movements consistent transactionally", async () => {
    const user = await createUser();
    const product = await createProduct();

    await inventoryService.receiveStock({
      productId: product.id,
      quantity: 10,
      unit: ProductUnit.PACK,
      reference: "DB-RECEIPT",
      userId: user.id,
    });
    await inventoryService.adjustStock({
      productId: product.id,
      quantityChange: -3,
      unit: ProductUnit.PACK,
      reason: "Count correction",
      userId: user.id,
    });
    await inventoryService.returnStock({
      productId: product.id,
      quantity: 2,
      unit: ProductUnit.PACK,
      userId: user.id,
    });

    const storedProduct = await prisma.product.findUniqueOrThrow({
      where: { id: product.id },
    });
    const movements = await prisma.stockMovement.findMany({
      where: { productId: product.id },
      orderBy: { occurredAt: "asc" },
    });

    expect(storedProduct.currentStock.toNumber()).toBe(9);
    expect(movements.map((movement) => movement.type)).toEqual([
      StockMovementType.RECEIVED,
      StockMovementType.ADJUSTMENT,
      StockMovementType.RETURN,
    ]);
    expect(movements.at(-1)?.newStock.toNumber()).toBe(9);
  });

  it("rolls back failed stock changes without movement or balance drift", async () => {
    const user = await createUser();
    const product = await createProduct();

    await expect(
      inventoryService.recordDamage({
        productId: product.id,
        quantity: 1,
        unit: ProductUnit.PACK,
        reason: "No stock available",
        userId: user.id,
      }),
    ).rejects.toMatchObject({ statusCode: 409 });

    const storedProduct = await prisma.product.findUniqueOrThrow({
      where: { id: product.id },
    });
    const movementCount = await prisma.stockMovement.count({
      where: { productId: product.id },
    });

    expect(storedProduct.currentStock.toNumber()).toBe(0);
    expect(movementCount).toBe(0);
  });

  it("serializes concurrent stock receipts without lost updates", async () => {
    const user = await createUser();
    const product = await createProduct();

    await Promise.all(
      Array.from({ length: 5 }, () =>
        inventoryService.receiveStock({
          productId: product.id,
          quantity: 1,
          unit: ProductUnit.PACK,
          userId: user.id,
        }),
      ),
    );

    const storedProduct = await prisma.product.findUniqueOrThrow({
      where: { id: product.id },
    });
    const movementCount = await prisma.stockMovement.count({
      where: { productId: product.id, type: StockMovementType.RECEIVED },
    });

    expect(storedProduct.currentStock.toNumber()).toBe(5);
    expect(movementCount).toBe(5);
  });

  it("preserves movement history after product deactivation", async () => {
    const user = await createUser();
    const product = await createProduct();

    await inventoryService.receiveStock({
      productId: product.id,
      quantity: 4,
      unit: ProductUnit.PACK,
      userId: user.id,
    });
    await prisma.product.update({
      where: { id: product.id },
      data: { active: false },
    });

    const movements = await inventoryService.listMovements({
      productId: product.id,
    });

    expect(movements).toHaveLength(1);
    expect(movements[0]?.product.active).toBe(false);
  });
});
