-- Fase 1 (PLAN_NOTIFICACIONES.md) — Fan-out de anuncios del superadmin

-- Limpia userIds huérfanos antes de crear la FK (usuarios borrados en datos legacy)
UPDATE "Notification" SET "userId" = NULL
WHERE "userId" IS NOT NULL AND "userId" NOT IN (SELECT id FROM "User");

-- Alcance legible del envío ("Todas las empresas", "Rol: Vendedor", ...)
ALTER TABLE "Notification" ADD COLUMN "targetLabel" TEXT;

ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Notification_companyId_userId_idx" ON "Notification"("companyId", "userId");
