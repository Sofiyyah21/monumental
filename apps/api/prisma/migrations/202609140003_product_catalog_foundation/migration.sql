ALTER TYPE "ProductCategory" RENAME VALUE 'DRINK' TO 'DRINKS';

ALTER TABLE "Product" DROP CONSTRAINT "Product_unit_matches_category";
ALTER TABLE "Product" DROP CONSTRAINT "Product_sellingPrice_positive";
ALTER TABLE "Product" DROP CONSTRAINT "Product_lowStockThreshold_nonnegative";

DROP INDEX "Product_name_key";

ALTER TABLE "Product" RENAME COLUMN "lowStockThreshold" TO "reorderLevel";
ALTER TABLE "Product" ADD COLUMN "sku" TEXT;

UPDATE "Product"
SET "sku" = 'LEGACY-' || "id"
WHERE "sku" IS NULL;

ALTER TABLE "Product" ALTER COLUMN "sku" SET NOT NULL;

CREATE UNIQUE INDEX "Product_sku_key" ON "Product"("sku");
CREATE INDEX "Product_unit_active_idx" ON "Product"("unit", "active");
CREATE INDEX "Product_name_idx" ON "Product"("name");

ALTER TABLE "Product"
  ADD CONSTRAINT "Product_sellingPrice_nonnegative" CHECK ("sellingPrice" >= 0),
  ADD CONSTRAINT "Product_reorderLevel_nonnegative" CHECK ("reorderLevel" >= 0),
  ADD CONSTRAINT "Product_unit_matches_category" CHECK (
    ("category" IN ('DRINKS', 'NOODLES') AND "unit" = 'PACK')
    OR ("category" = 'VEGETABLE_OIL' AND "unit" = 'LITER')
    OR ("category" = 'SUGAR' AND "unit" = 'CUP')
  );
