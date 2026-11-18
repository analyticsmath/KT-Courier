-- Add nullable payment deadline timestamp and composite expiry scan index on Order.
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "paymentDueAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "Order_status_paymentDueAt_idx"
  ON "Order"("status", "paymentDueAt");
