-- Fase 5.3 — Notificaciones in-app
CREATE TABLE "Notification" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "userId" INTEGER,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "dedupeKey" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Notification_companyId_readAt_idx" ON "Notification"("companyId", "readAt");
CREATE INDEX "Notification_companyId_dedupeKey_idx" ON "Notification"("companyId", "dedupeKey");

ALTER TABLE "Notification" ADD CONSTRAINT "Notification_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Fase 5.3 — Umbral de stock bajo por producto (0 = sin alerta)
ALTER TABLE "Product" ADD COLUMN "minStock" INTEGER NOT NULL DEFAULT 0;
