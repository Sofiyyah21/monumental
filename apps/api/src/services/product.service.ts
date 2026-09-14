import { Prisma } from "@prisma/client";
import type { ProductCategory, ProductUnit } from "@prisma/client";
import { productUnitByCategory } from "../constants.js";
import { AppError } from "../lib/app-error.js";
import type { DatabaseClient } from "../lib/database.js";

export type CreateProductInput = {
  name: string;
  sku: string;
  category: ProductCategory;
  unit: ProductUnit;
  costPrice: number;
  sellingPrice: number;
  reorderLevel: number;
};

export type UpdateProductInput = Partial<CreateProductInput> & {
  active?: boolean;
};

export type ListProductsInput = {
  category?: ProductCategory;
  unit?: ProductUnit;
  active?: boolean;
  search?: string;
};

export class ProductService {
  constructor(private readonly db: DatabaseClient) {}

  async list(input: ListProductsInput = {}) {
    return this.db.product.findMany({
      where: {
        category: input.category,
        unit: input.unit,
        active: input.active ?? true,
        OR: input.search
          ? [
              { name: { contains: input.search, mode: "insensitive" } },
              { sku: { contains: input.search, mode: "insensitive" } },
            ]
          : undefined,
      },
      orderBy: [{ category: "asc" }, { name: "asc" }],
    });
  }

  async getById(id: string) {
    const product = await this.db.product.findUnique({ where: { id } });
    if (!product) {
      throw new AppError("Product not found", 404, "PRODUCT_NOT_FOUND");
    }
    return product;
  }

  async create(input: CreateProductInput) {
    this.assertUnitMatchesCategory(input.category, input.unit);

    try {
      return await this.db.product.create({
        data: input,
      });
    } catch (error) {
      this.handleKnownProductError(error);
    }
  }

  async update(id: string, input: UpdateProductInput) {
    const product = await this.getById(id);
    const category = input.category ?? product.category;
    const unit =
      input.unit ??
      (input.category ? productUnitByCategory[category] : product.unit);
    this.assertUnitMatchesCategory(category, unit);

    try {
      return await this.db.product.update({
        where: { id },
        data: { ...input, unit },
      });
    } catch (error) {
      this.handleKnownProductError(error);
    }
  }

  async deactivate(id: string) {
    try {
      return await this.db.product.update({
        where: { id },
        data: { active: false },
      });
    } catch (error) {
      this.handleKnownProductError(error);
    }
  }

  private assertUnitMatchesCategory(
    category: ProductCategory,
    unit: ProductUnit,
  ) {
    if (productUnitByCategory[category] !== unit) {
      throw new AppError(
        `${category} products must use ${productUnitByCategory[category]}`,
        400,
        "INVALID_PRODUCT_UNIT",
      );
    }
  }

  private handleKnownProductError(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        throw new AppError("Product not found", 404, "PRODUCT_NOT_FOUND");
      }

      if (error.code === "P2002") {
        throw new AppError(
          "A product with this SKU already exists",
          409,
          "PRODUCT_SKU_EXISTS",
        );
      }
    }

    throw error;
  }
}
