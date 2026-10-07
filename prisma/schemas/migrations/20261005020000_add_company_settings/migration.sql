-- Fase 5.5 — Configuración de la empresa (moneda base, % IVA,
-- numeración de documentos y logo)
ALTER TABLE "Company"
  ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'USD',
  ADD COLUMN "taxRate" INTEGER NOT NULL DEFAULT 19,
  ADD COLUMN "invoicePrefix" TEXT NOT NULL DEFAULT 'FAC',
  ADD COLUMN "salePrefix" TEXT NOT NULL DEFAULT 'VEN',
  ADD COLUMN "logoUrl" TEXT;

-- Sincroniza las vistas explícitas de los planes existentes con los defaults
-- del código: añade 'settings' (Fase 5.5) y 'suscripcion' (que el seed no
-- incluía) a los planes con allowedViews en JSON.
UPDATE "Plan"
SET "allowedViews" = "allowedViews" || '["suscripcion"]'::jsonb
WHERE "allowedViews" IS NOT NULL
  AND jsonb_typeof("allowedViews") = 'array'
  AND NOT ("allowedViews" @> '["suscripcion"]'::jsonb);

UPDATE "Plan"
SET "allowedViews" = "allowedViews" || '["settings"]'::jsonb
WHERE "allowedViews" IS NOT NULL
  AND jsonb_typeof("allowedViews") = 'array'
  AND NOT ("allowedViews" @> '["settings"]'::jsonb);
