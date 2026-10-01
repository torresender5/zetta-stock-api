-- AlterTable
ALTER TABLE "Product" ADD COLUMN "categoryId" INTEGER;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_categoryId_fkey"
  FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: crea una categoría por cada (companyId, nombre) distinto usado en Product.category
INSERT INTO "Category" ("companyId", "name", "code", "createdAt")
SELECT n."companyId",
       n.name,
       'CAT-' || to_char(now(), 'YYYY') || '-' || lpad(n.rn::text, 4, '0'),
       now()
FROM (
  SELECT d."companyId",
         d.name,
         row_number() OVER (PARTITION BY d."companyId" ORDER BY d.name) AS rn
  FROM (
    SELECT DISTINCT "companyId", category AS name
    FROM "Product"
    WHERE category IS NOT NULL AND btrim(category) <> ''
  ) d
) n
WHERE NOT EXISTS (
  SELECT 1 FROM "Category" c
  WHERE c."companyId" IS NOT DISTINCT FROM n."companyId"
    AND lower(c.name) = lower(n.name)
);

-- Backfill: enlaza cada producto con su categoría recién creada
UPDATE "Product" p
SET "categoryId" = c.id
FROM "Category" c
WHERE p."categoryId" IS NULL
  AND p.category IS NOT NULL
  AND lower(p.category) = lower(c.name)
  AND p."companyId" IS NOT DISTINCT FROM c."companyId";
