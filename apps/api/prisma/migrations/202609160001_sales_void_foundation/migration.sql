-- Add sale void audit metadata while preserving historical sale and sale item records.
ALTER TABLE "Sale"
ADD COLUMN "voidedAt" TIMESTAMP(3),
ADD COLUMN "voidedById" TEXT,
ADD COLUMN "voidReason" TEXT;

ALTER TABLE "Sale"
ADD CONSTRAINT "Sale_voidedById_fkey"
FOREIGN KEY ("voidedById") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Sale_voidedById_voidedAt_idx" ON "Sale"("voidedById", "voidedAt");
