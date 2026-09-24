-- AlterTable
ALTER TABLE "Purchase" ADD COLUMN "purchaseNumber" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Purchase_companyId_purchaseNumber_key" ON "Purchase"("companyId", "purchaseNumber");