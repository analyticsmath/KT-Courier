import { describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import {
  AcceptanceEvidenceSchema,
  assertSandboxPaymentAcceptance,
  computePaymentProvenanceDigest,
  verifyAcceptanceProvenanceWithAdapters,
} from "@/lib/production-readiness/evidence";

describe("acceptance provenance & timing verification", () => {
  const releaseSha = "691ebded959858e86b4cb28674f52394c1f5676c";
  const paymentCreatedAt = new Date("2026-10-07T00:00:00.000Z");
  const providerConfirmedAt = new Date("2026-10-07T00:02:00.000Z");
  const observedAt = "2026-10-07T00:05:00.000Z";
  const expiresAt = "2026-10-07T02:00:00.000Z";
  const reviewNow = new Date("2026-10-07T00:10:00.000Z");

  const sandboxEvidence = {
    kind: "SANDBOX" as const,
    key: "payment_integration_acceptance" as const,
    releaseSha,
    observedAt,
    expiresAt,
    evidenceReference: "admin:verified-sandbox-payment",
    reason: "Provider-hosted Paystack sandbox payment and isolated ledger confirmed",
    genuineOperatorAcceptance: true as const,
    provider: "PAYSTACK" as const,
    paymentReference: "pay_sbox_abcdef1234567890",
    amount: "10.00",
    currency: "ZAR" as const,
  };

  function makeValidCandidate(overrides: Partial<{
    releaseSha: string;
    subjectType: string;
    ledgerJournalId: string;
    providerConfirmedAt: Date;
    paymentCreatedAt: Date;
    omitProvenance: boolean;
    tamperDigest: boolean;
  }> = {}) {
    const provReleaseSha = overrides.releaseSha ?? releaseSha;
    const subjectType = overrides.subjectType ?? "SANDBOX_ACCEPTANCE";
    const ledgerJournalId = overrides.ledgerJournalId ?? "journal_sbox_1";
    const confirmedAt = overrides.providerConfirmedAt ?? providerConfirmedAt;
    const createdAt = overrides.paymentCreatedAt ?? paymentCreatedAt;

    const resultDigest = overrides.tamperDigest
      ? "f".repeat(64)
      : computePaymentProvenanceDigest({
          paymentReference: sandboxEvidence.paymentReference,
          attemptReference: "patsbox_001",
          ledgerJournalId,
          provider: "PAYSTACK",
          providerEnvironment: "SANDBOX",
          subjectType,
          subjectNamespace: "platform-sandbox-acceptance",
          amount: "10.00",
          currency: "ZAR",
          providerReference: "99887766",
          paymentCreatedAt: createdAt,
          providerConfirmedAt: confirmedAt,
          releaseSha: provReleaseSha,
          deploymentId: "545fd6ec-13d6-4d33-9f31-073f1ea3440e",
        });

    return {
      publicReference: sandboxEvidence.paymentReference,
      provider: "PAYSTACK" as const,
      status: "SUCCEEDED" as const,
      amount: new Prisma.Decimal("10.00"),
      currency: "ZAR" as const,
      subjectType,
      createdAt,
      successLedgerJournalId: "journal_sbox_1",
      providerConfirmedAt: confirmedAt,
      reconciliationStatus: "CLEAR" as const,
      successfulAttempt: {
        publicReference: "patsbox_001",
        provider: "PAYSTACK" as const,
        status: "SUCCEEDED" as const,
        providerEnvironment: "SANDBOX" as const,
        amount: new Prisma.Decimal("10.00"),
        currency: "ZAR" as const,
        providerReference: "99887766",
        providerConfirmedAt: confirmedAt,
      },
      releaseProvenance: overrides.omitProvenance
        ? null
        : {
            paymentReference: sandboxEvidence.paymentReference,
            attemptId: "patsbox_001",
            ledgerJournalId,
            provider: "PAYSTACK" as const,
            providerEnvironment: "SANDBOX" as const,
            subjectType,
            subjectNamespace: "platform-sandbox-acceptance",
            providerReference: "99887766",
            amount: new Prisma.Decimal("10.00"),
            currency: "ZAR" as const,
            releaseSha: provReleaseSha,
            deploymentId: "545fd6ec-13d6-4d33-9f31-073f1ea3440e",
            paymentCreatedAt: createdAt,
            providerConfirmedAt: confirmedAt,
            resultDigest,
          },
    };
  }

  it("accepts a genuine sandbox payment bound to exact release provenance and later observation time", () => {
    expect(() => assertSandboxPaymentAcceptance(makeValidCandidate(), sandboxEvidence)).not.toThrow();
  });

  it("rejects old-release payments without provenance or bound to an earlier release SHA", () => {
    expect(() => assertSandboxPaymentAcceptance(makeValidCandidate({ omitProvenance: true }), sandboxEvidence)).toThrow();
    expect(() => assertSandboxPaymentAcceptance(makeValidCandidate({ releaseSha: "8031c874".padEnd(40, "0") }), sandboxEvidence)).toThrow();
  });

  it("enforces observedAt >= providerConfirmedAt", () => {
    const confirmedLater = makeValidCandidate({ providerConfirmedAt: new Date("2026-10-07T00:06:00.000Z") });
    expect(() => assertSandboxPaymentAcceptance(confirmedLater, sandboxEvidence)).toThrow(/observation timestamp|confirmation/i);
  });

  it("rejects tampered digest, mismatched journal, and disallowed subject", () => {
    expect(() => assertSandboxPaymentAcceptance(makeValidCandidate({ tamperDigest: true }), sandboxEvidence)).toThrow();
    expect(() => assertSandboxPaymentAcceptance(makeValidCandidate({ ledgerJournalId: "journal_other" }), sandboxEvidence)).toThrow();
    expect(() => assertSandboxPaymentAcceptance(makeValidCandidate({ subjectType: "SUBSCRIPTION_INVOICE" }), sandboxEvidence)).toThrow();
  });

  it("rejects PARITY evidence when deployment SHAs differ from claimed releaseSha, while accepting matching SHAs", () => {
    const baseParity = {
      kind: "PARITY" as const,
      key: "production_deployment_sha_parity" as const,
      releaseSha,
      observedAt,
      expiresAt,
      evidenceReference: "audit:parity-1",
      reason: "Verify production deployment parity",
      vercelSha: releaseSha,
      webSha: releaseSha,
      operationsSha: releaseSha,
      vercelDeploymentId: "dpl_5Dq9XL1B5eSp3VneVKh2mBqyg9rR",
      webDeploymentId: "545fd6ec-13d6-4d33-9f31-073f1ea3440e",
      operationsDeploymentId: "98beae70-56e2-426f-87e2-955c56fda0e5",
      protectedDataAuditReference: "audit-receipt-001",
      protectedDataUnchanged: true as const,
    };
    expect(AcceptanceEvidenceSchema.safeParse(baseParity).success).toBe(true);
    expect(AcceptanceEvidenceSchema.safeParse({ ...baseParity, vercelSha: "b".repeat(40) }).success).toBe(false);
    expect(AcceptanceEvidenceSchema.safeParse({ ...baseParity, webSha: "b".repeat(40) }).success).toBe(false);
    expect(AcceptanceEvidenceSchema.safeParse({ ...baseParity, operationsSha: "b".repeat(40) }).success).toBe(false);
  });

  it("fails closed on CI and PARITY server verification when required and unconfigured or mismatched", async () => {
    const ciEvidence = {
      kind: "CI" as const,
      key: "current_ci_certification" as const,
      releaseSha,
      observedAt,
      expiresAt,
      evidenceReference: "ci:45352739746",
      reason: "Verify exact SHA CI and certification run",
      runUrl: "https://github.com/analyticsmath/KT-Courier/actions/runs/45352739746",
      conclusion: "SUCCESS" as const,
      skippedCriticalTests: 0 as const,
      testsPassed: 5933,
    };

    await expect(
      verifyAcceptanceProvenanceWithAdapters(ciEvidence, {
        now: reviewNow,
        requireServerVerification: true,
        env: { NODE_ENV: "production", KT_DATABASE_CLASSIFICATION: "production" },
      }),
    ).rejects.toMatchObject({ status: 409 });

    const verifyCiRun = vi.fn().mockResolvedValue({
      headSha: releaseSha,
      status: "completed",
      conclusion: "success",
      completedAt: "2026-10-07T00:04:00.000Z",
      jobsPassed: 26,
      skippedJobs: 0,
    });

    const verified = await verifyAcceptanceProvenanceWithAdapters(ciEvidence, {
      now: reviewNow,
      requireServerVerification: true,
      env: { NODE_ENV: "production", KT_DATABASE_CLASSIFICATION: "production", RAILWAY_GIT_COMMIT_SHA: releaseSha },
      adapters: { verifyCiRun },
    });
    expect(verified.verificationMode).toBe("SERVER_VERIFIED");
    expect(verifyCiRun).toHaveBeenCalledTimes(1);

    verifyCiRun.mockResolvedValueOnce({
      headSha: "c".repeat(40),
      status: "completed",
      conclusion: "success",
      completedAt: "2026-10-07T00:04:00.000Z",
      jobsPassed: 26,
      skippedJobs: 0,
    });
    await expect(
      verifyAcceptanceProvenanceWithAdapters(ciEvidence, {
        now: reviewNow,
        requireServerVerification: true,
        env: { NODE_ENV: "production", KT_DATABASE_CLASSIFICATION: "production", RAILWAY_GIT_COMMIT_SHA: releaseSha },
        adapters: { verifyCiRun },
      }),
    ).rejects.toMatchObject({ status: 409 });
  });
});
