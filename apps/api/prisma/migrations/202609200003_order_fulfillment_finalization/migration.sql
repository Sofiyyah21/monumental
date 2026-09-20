-- AlterTable
ALTER TABLE "Order"
ADD COLUMN "paymentMethod" "PaymentMethod";

-- AlterTable
ALTER TABLE "Sale"
ADD COLUMN "orderId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Sale_orderId_key" ON "Sale"("orderId");

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
