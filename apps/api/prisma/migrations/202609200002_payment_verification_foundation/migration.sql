-- AlterTable
ALTER TABLE "Order"
ADD COLUMN "paidAt" TIMESTAMP(3),
ADD COLUMN "paidById" TEXT;

-- CreateIndex
CREATE INDEX "Order_paidById_paidAt_idx" ON "Order"("paidById", "paidAt");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_paidById_fkey" FOREIGN KEY ("paidById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
