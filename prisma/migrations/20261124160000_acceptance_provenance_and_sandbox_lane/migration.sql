CREATE TABLE "PaystackSandboxVerification" (
  "id" TEXT NOT NULL,
  "reference" VARCHAR(100) NOT NULL,
  "attemptReference" VARCHAR(100) NOT NULL,
  "idempotencyKey" VARCHAR(80) NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "payerEmail" VARCHAR(254) NOT NULL,
  "amountCents" INTEGER NOT NULL DEFAULT 1000,
  "currency" "LedgerCurrency" NOT NULL DEFAULT 'ZAR',
  "status" VARCHAR(32) NOT NULL DEFAULT 'CREATED',
  "checkoutUrl" TEXT,
  "providerDomain" VARCHAR(32),
  "providerReference" VARCHAR(100),
  "providerTransactionId" VARCHAR(80),
  "releaseSha" VARCHAR(40) NOT NULL,
  "deploymentId" VARCHAR(120),
  "ledgerJournalId" TEXT,
  "failureCode" VARCHAR(80),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "verifiedAt" TIMESTAMP(3),

  CONSTRAINT "PaystackSandboxVerification_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PaystackSandboxVerification_amount_check" CHECK ("amountCents" >= 100 AND "amountCents" <= 50000),
  CONSTRAINT "PaystackSandboxVerification_releaseSha_check" CHECK ("releaseSha" ~ '^[a-f0-9]{40}$'),
  CONSTRAINT "PaystackSandboxVerification_domain_check" CHECK ("providerDomain" IS NULL OR "providerDomain" = 'test'),
  CONSTRAINT "PaystackSandboxVerification_succeeded_check" CHECK (
    "status" <> 'SUCCEEDED'
    OR ("ledgerJournalId" IS NOT NULL AND "verifiedAt" IS NOT NULL AND "providerDomain" = 'test' AND "providerReference" IS NOT NULL)
  )
);

CREATE UNIQUE INDEX "PaystackSandboxVerification_reference_key" ON "PaystackSandboxVerification"("reference");
CREATE UNIQUE INDEX "PaystackSandboxVerification_attemptReference_key" ON "PaystackSandboxVerification"("attemptReference");
CREATE UNIQUE INDEX "PaystackSandboxVerification_idempotencyKey_key" ON "PaystackSandboxVerification"("idempotencyKey");
CREATE UNIQUE INDEX "PaystackSandboxVerification_ledgerJournalId_key" ON "PaystackSandboxVerification"("ledgerJournalId");
CREATE INDEX "PaystackSandboxVerification_actorUserId_createdAt_idx" ON "PaystackSandboxVerification"("actorUserId", "createdAt");
CREATE INDEX "PaystackSandboxVerification_status_createdAt_idx" ON "PaystackSandboxVerification"("status", "createdAt");
CREATE INDEX "PaystackSandboxVerification_releaseSha_status_createdAt_idx" ON "PaystackSandboxVerification"("releaseSha", "status", "createdAt");

ALTER TABLE "PaystackSandboxVerification"
  ADD CONSTRAINT "PaystackSandboxVerification_ledgerJournalId_fkey"
  FOREIGN KEY ("ledgerJournalId") REFERENCES "LedgerJournal"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "PaymentReleaseProvenance" (
  "id" TEXT NOT NULL,
  "paymentReference" VARCHAR(100) NOT NULL,
  "paymentId" TEXT,
  "attemptId" VARCHAR(80),
  "sandboxVerificationId" TEXT,
  "ledgerJournalId" TEXT NOT NULL,
  "provider" "PaymentProvider" NOT NULL,
  "providerEnvironment" "PaymentProviderEnvironment" NOT NULL,
  "subjectType" VARCHAR(64) NOT NULL,
  "subjectNamespace" VARCHAR(64) NOT NULL,
  "providerReference" VARCHAR(120) NOT NULL,
  "amount" DECIMAL(18,2) NOT NULL,
  "currency" "LedgerCurrency" NOT NULL DEFAULT 'ZAR',
  "releaseSha" VARCHAR(40) NOT NULL,
  "deploymentId" VARCHAR(120),
  "paymentCreatedAt" TIMESTAMP(3) NOT NULL,
  "providerConfirmedAt" TIMESTAMP(3) NOT NULL,
  "resultDigest" VARCHAR(64) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PaymentReleaseProvenance_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PaymentReleaseProvenance_subject_link_check" CHECK ("paymentId" IS NOT NULL OR "sandboxVerificationId" IS NOT NULL),
  CONSTRAINT "PaymentReleaseProvenance_releaseSha_check" CHECK ("releaseSha" ~ '^[a-f0-9]{40}$'),
  CONSTRAINT "PaymentReleaseProvenance_resultDigest_check" CHECK ("resultDigest" ~ '^[a-f0-9]{64}$'),
  CONSTRAINT "PaymentReleaseProvenance_amount_check" CHECK ("amount" > 0)
);

CREATE UNIQUE INDEX "PaymentReleaseProvenance_paymentReference_key" ON "PaymentReleaseProvenance"("paymentReference");
CREATE UNIQUE INDEX "PaymentReleaseProvenance_paymentId_key" ON "PaymentReleaseProvenance"("paymentId");
CREATE UNIQUE INDEX "PaymentReleaseProvenance_sandboxVerificationId_key" ON "PaymentReleaseProvenance"("sandboxVerificationId");
CREATE UNIQUE INDEX "PaymentReleaseProvenance_ledgerJournalId_key" ON "PaymentReleaseProvenance"("ledgerJournalId");
CREATE INDEX "PaymentReleaseProvenance_releaseSha_createdAt_idx" ON "PaymentReleaseProvenance"("releaseSha", "createdAt");
CREATE INDEX "PaymentReleaseProvenance_provider_providerEnvironment_releaseSh_idx" ON "PaymentReleaseProvenance"("provider", "providerEnvironment", "releaseSha");

ALTER TABLE "PaymentReleaseProvenance"
  ADD CONSTRAINT "PaymentReleaseProvenance_paymentId_fkey"
  FOREIGN KEY ("paymentId") REFERENCES "Payment"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PaymentReleaseProvenance"
  ADD CONSTRAINT "PaymentReleaseProvenance_sandboxVerificationId_fkey"
  FOREIGN KEY ("sandboxVerificationId") REFERENCES "PaystackSandboxVerification"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PaymentReleaseProvenance"
  ADD CONSTRAINT "PaymentReleaseProvenance_ledgerJournalId_fkey"
  FOREIGN KEY ("ledgerJournalId") REFERENCES "LedgerJournal"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION "kt_prevent_payment_release_provenance_mutation"()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'PaymentReleaseProvenance records are immutable once persisted.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "PaymentReleaseProvenance_immutable_guard"
BEFORE UPDATE OR DELETE ON "PaymentReleaseProvenance"
FOR EACH ROW
EXECUTE FUNCTION "kt_prevent_payment_release_provenance_mutation"();
