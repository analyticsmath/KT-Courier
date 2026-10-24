BEGIN;

-- Preserve historical rows and all financial records. New orders remain LIVE.
ALTER TABLE "MarketplaceStoreOrder"
  ADD COLUMN IF NOT EXISTS "operationalScope" TEXT NOT NULL DEFAULT 'LIVE',
  ADD COLUMN IF NOT EXISTS "historySourceReference" TEXT;

-- This exact signature is authored by scripts/seed-full-demo.ts. A date,
-- missing snapshot, reference prefix, or payment provider alone is insufficient.
UPDATE "MarketplaceStoreOrder" AS so
SET "operationalScope" = 'HISTORICAL',
    "historySourceReference" = 'DEMO_SIMULATION_20260912:' || mo."publicReference"
FROM "MarketplaceOrder" mo, "MarketplaceCheckout" co, "Payment" p, "PaymentAttempt" pa
WHERE so."marketplaceOrderId" = mo.id
  AND mo."checkoutId" = co.id AND mo."paymentId" = p.id
  AND p."successfulAttemptId" = pa.id AND pa."paymentId" = p.id
  AND mo."publicReference" ~ '^MKT-2026-000[0-9]{3}$'
  AND substring(mo."publicReference" from 10)::integer BETWEEN 1 AND 420
  AND so."publicReference" = replace(mo."publicReference", 'MKT-', 'MSO-')
  AND co."publicReference" = replace(mo."publicReference", 'MKT-', 'CHK-')
  AND co."commercialFingerprint" = 'fp-' || mo."publicReference"
  AND mo."commercialFingerprint" = co."commercialFingerprint"
  AND p."provider" = 'PAYFAST' AND pa."provider" = 'PAYFAST'
  AND p."paymentNumber" = 'PAY-' || mo."publicReference"
  AND p."idempotencyKey" = 'idem_pay_mkt_' || mo."publicReference"
  AND p."creationRequestHash" = encode(sha256(convert_to('pay_mkt_' || mo."publicReference", 'UTF8')), 'hex')
  AND pa."providerReference" = 'pf_mkt_' || mo."publicReference"
  AND pa."idempotencyKey" = 'att_idem_mkt_' || mo."publicReference"
  AND so."createdAt" BETWEEN '2026-03-01T00:00:00Z' AND '2026-09-12T23:59:59Z'
  AND so."operationalPolicyId" IS NULL AND so."deliveryBridgeStatus" = 'NOT_REQUESTED';

-- Imported orders qualify only through completed, explicit read-only provenance.
-- Catalog/store mappings never classify orders created later by those stores.
UPDATE "MarketplaceStoreOrder" AS so
SET "operationalScope" = 'HISTORICAL', "historySourceReference" = 'LEGACY_MIGRATION_MAP:' || m.id
FROM "LegacyMigrationMap" m JOIN "LegacyMigrationRun" r ON r.id = m."runId"
WHERE m."targetModel" = 'MarketplaceStoreOrder' AND m."targetId" = so.id
  AND m."sourceTable" IN ('orders', 'order_details')
  AND m."disposition" = 'HISTORICAL_READ_ONLY' AND r.status = 'APPLIED'
  AND so."operationalScope" = 'LIVE' AND so."operationalPolicyId" IS NULL
  AND so."deliveryBridgeStatus" = 'NOT_REQUESTED';

ALTER TABLE "MarketplaceStoreOrder" ADD CONSTRAINT "MarketplaceStoreOrder_history_scope_check"
  CHECK (("operationalScope" = 'LIVE' AND "historySourceReference" IS NULL)
    OR ("operationalScope" = 'HISTORICAL' AND "historySourceReference" IS NOT NULL AND length("historySourceReference") > 0));

CREATE FUNCTION protect_marketplace_order_history_scope() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."operationalScope" IS DISTINCT FROM OLD."operationalScope"
    OR NEW."historySourceReference" IS DISTINCT FROM OLD."historySourceReference" THEN
    RAISE EXCEPTION 'Marketplace order origin is immutable';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "MarketplaceStoreOrder_history_scope_immutable"
BEFORE UPDATE ON "MarketplaceStoreOrder" FOR EACH ROW
EXECUTE FUNCTION protect_marketplace_order_history_scope();

CREATE INDEX "MarketplaceStoreOrder_operationalScope_operationalPolicyId_idx"
  ON "MarketplaceStoreOrder"("operationalScope", "operationalPolicyId");

COMMIT;
