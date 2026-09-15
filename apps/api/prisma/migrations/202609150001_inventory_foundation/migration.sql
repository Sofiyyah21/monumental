ALTER TYPE "StockMovementType" ADD VALUE 'DAMAGE';

ALTER TABLE "StockMovement" ADD COLUMN "reference" TEXT;

ALTER TABLE "StockMovement" DROP CONSTRAINT "StockMovement_quantity_nonnegative";
ALTER TABLE "StockMovement"
  ADD CONSTRAINT "StockMovement_quantity_positive" CHECK ("quantity" > 0);

CREATE INDEX "StockMovement_createdById_occurredAt_idx" ON "StockMovement"("createdById", "occurredAt");
