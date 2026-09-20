-- AlterTable
ALTER TABLE "Order"
ADD COLUMN "confirmedAt" TIMESTAMP(3),
ADD COLUMN "confirmedById" TEXT,
ADD COLUMN "fulfilledAt" TIMESTAMP(3),
ADD COLUMN "fulfilledById" TEXT,
ADD COLUMN "cancelledById" TEXT;

-- CreateIndex
CREATE INDEX "Order_confirmedById_confirmedAt_idx" ON "Order"("confirmedById", "confirmedAt");

-- CreateIndex
CREATE INDEX "Order_fulfilledById_fulfilledAt_idx" ON "Order"("fulfilledById", "fulfilledAt");

-- CreateIndex
CREATE INDEX "Order_cancelledById_cancelledAt_idx" ON "Order"("cancelledById", "cancelledAt");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_confirmedById_fkey" FOREIGN KEY ("confirmedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_fulfilledById_fkey" FOREIGN KEY ("fulfilledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
