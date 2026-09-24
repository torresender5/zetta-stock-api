-- Backfill
-- Asigna códigos de compra secuenciales COMP-YYYY-#### a filas existentes,
-- agrupadas por empresa (companyId) y año de la fecha, ordenadas por id.
UPDATE "Purchase" p
SET "purchaseNumber" =
  'COMP-' || b.yr || '-' || LPAD(b.seq::text, 4, '0')
FROM (
  SELECT pp.id,
         EXTRACT(YEAR FROM pp."date")::int AS yr,
         ROW_NUMBER() OVER (
           PARTITION BY pp."companyId", EXTRACT(YEAR FROM pp."date")
           ORDER BY pp.id
         ) AS seq
  FROM "Purchase" pp
) b
WHERE p.id = b.id
  AND p."purchaseNumber" IS NULL;