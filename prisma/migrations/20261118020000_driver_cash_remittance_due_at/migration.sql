-- Additive column and index for enforceable Africa/Johannesburg end-of-day driver cash remittance SLA.
ALTER TABLE "CashOnDelivery" ADD COLUMN IF NOT EXISTS "remittanceDueAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "CashOnDelivery_status_remittanceDueAt_idx" ON "CashOnDelivery"("status", "remittanceDueAt");
