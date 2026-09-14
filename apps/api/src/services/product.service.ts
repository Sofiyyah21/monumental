import { Prisma } from "@prisma/client";
import type { ProductCategory } from "@prisma/client";
import { productUnitByCategory } from "../constants.js";
import { AppError } from "../lib/app-error.js";
import type { DatabaseClient } from "../lib/database.js";

export type CreateProductInput = {
  name: string;
  category: ProductCategory;
  costPrice: number;
  sellingPrice: number;
  lowStockThreshold: number;
};

export type UpdateProductInput = Partial<CreateProductInput> & {
  active?: boolean;
};

export class ProductService {
  constructor(private readonly db: DatabaseClient) {}

  async list(includeInactive = false) {
    return this.db.product.findMany({
      where: includeInactive ? undefined : { active: true },
      orderBy: [{ category: "asc" }, { name: "asc" }],
    });
  }

  async create(input: CreateProductInput) {
    try {
      return await this.db.product.create({
        data: {
          ...input,
          unit: productUnitByCategory[input.category],
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new AppError(
          "A product with this name already exists",
          409,
          "PRODUCT_EXISTS",
        );
      }
      throw error;
    }
  }

  async update(id: string, input: UpdateProductInput) {
    const data = {
      ...input,
      unit: input.category ? productUnitByCategory[input.category] : undefined,
    };

    try {
      return await this.db.product.update({
        where: { id },
        data,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2025"
      ) {
        throw new AppError("Product not found", 404, "PRODUCT_NOT_FOUND");
      }
      throw error;
    }
  }
}
