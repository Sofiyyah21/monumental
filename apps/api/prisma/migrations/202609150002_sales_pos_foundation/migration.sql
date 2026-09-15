CREATE TYPE "PaymentStatus" AS ENUM ('PAID', 'PENDING');
CREATE SEQUENCE "SaleReferenceSequence";

ALTER TABLE "Sale"
  ADD COLUMN "reference" TEXT,
  ADD COLUMN "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'PAID',
  ADD COLUMN "subtotal" DECIMAL(12,2),
  ADD COLUMN "discountAmount" DECIMAL(12,2) NOT NULL DEFAULT 0;

UPDATE "Sale"
SET
  "reference" = 'LEGACY-' || "id",
  "subtotal" = "totalAmount" + "discountAmount"
WHERE "reference" IS NULL;

ALTER TABLE "Sale"
  ALTER COLUMN "reference" SET NOT NULL,
  ALTER COLUMN "subtotal" SET NOT NULL;

CREATE UNIQUE INDEX "Sale_reference_key" ON "Sale"("reference");
CREATE INDEX "Sale_paymentStatus_soldAt_idx" ON "Sale"("paymentStatus", "soldAt");

ALTER TABLE "SaleItem" DROP CONSTRAINT "SaleItem_unitPrice_positive";
ALTER TABLE "SaleItem"
  ADD CONSTRAINT "SaleItem_unitPrice_nonnegative" CHECK ("unitPrice" >= 0);

ALTER TABLE "Sale"
  ADD CONSTRAINT "Sale_subtotal_nonnegative" CHECK ("subtotal" >= 0),
  ADD CONSTRAINT "Sale_discountAmount_nonnegative" CHECK ("discountAmount" >= 0),
  ADD CONSTRAINT "Sale_discountAmount_not_above_subtotal" CHECK ("discountAmount" <= "subtotal");
