import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (file: string) => readFileSync(path.join(process.cwd(), file), "utf8");

describe("Phase B catalog/payment reconciliation guards", () => {
  it("classifies only non-production demo publications while preserving the production source lock", () => {
    const preflight = read("scripts/phase18-catalog-preflight.mjs");
    const verifier = read("scripts/verify-catalog-invariants.mjs");
    const lock = read("lib/catalog/catalog-production-lock.ts");

    expect(preflight).toMatch(/process\.env\.NODE_ENV === "production"/);
    expect(preflight).toMatch(/CLASSIFIED: existing local-demo publication projections/);
    expect(verifier).toMatch(/CLASSIFIED: 24 existing local-demo publication snapshots/);
    expect(lock).toMatch(/CATALOG_PRODUCTION_VALIDATION_APPROVED\s*=\s*false/);
  });

  it("requires canonical payment evidence and does not mistake null marketplace order ids for duplicates", () => {
    const preflight = read("scripts/phase10-payment-preflight.mjs");
    const verifier = read("scripts/verify-payment-invariants.mjs");
    const seed = read("scripts/seed-full-demo.ts");
    const migration = read("prisma/migrations/20260811120000_phase_b_payment_attempt_completion_backfill/migration.sql");

    expect(preflight).toMatch(/successfulWithoutEvidence/);
    expect(preflight).toMatch(/terminalAttemptsMissingCompletion/);
    expect(verifier).toMatch(/"subjectType"::text='COURIER_ORDER'/);
    expect(seed).toMatch(/completedAt: params\.createdAt/);
    expect(migration).toMatch(/p\."successWebhookEventId" IS NOT NULL/);
    expect(migration).toMatch(/p\."successLedgerJournalId" IS NOT NULL/);
  });
});
