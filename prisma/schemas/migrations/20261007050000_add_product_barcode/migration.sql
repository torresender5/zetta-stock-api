-- Escaneo de códigos de barras: columna dedicada por producto
ALTER TABLE "Product" ADD COLUMN "barcode" TEXT;

CREATE INDEX "Product_companyId_barcode_idx" ON "Product"("companyId", "barcode");
