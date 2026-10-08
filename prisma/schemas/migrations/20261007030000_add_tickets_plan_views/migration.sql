-- Sincroniza las vistas explícitas de los planes existentes con los defaults
-- del código: añade 'tickets' a los planes con allowedViews en JSON, para que
-- el Administrador pueda abrir tickets en cualquier plan.
UPDATE "Plan"
SET "allowedViews" = "allowedViews" || '["tickets"]'::jsonb
WHERE "allowedViews" IS NOT NULL
  AND jsonb_typeof("allowedViews") = 'array'
  AND NOT ("allowedViews" @> '["tickets"]'::jsonb);
