-- Fase 5.1 — Pasarela de pagos (Stripe USD + Pabilo, link en USD)
ALTER TABLE "PaymentOrder" ADD COLUMN "provider" TEXT NOT NULL DEFAULT 'manual';
ALTER TABLE "PaymentOrder" ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'USD';
ALTER TABLE "PaymentOrder" ADD COLUMN "checkoutUrl" TEXT;
ALTER TABLE "PaymentOrder" ADD COLUMN "providerRef" TEXT;
ALTER TABLE "PaymentOrder" ADD COLUMN "expiresAt" TIMESTAMP(3);

CREATE INDEX "PaymentOrder_providerRef_idx" ON "PaymentOrder"("providerRef");
