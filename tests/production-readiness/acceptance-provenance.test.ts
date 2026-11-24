import { describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import {
  AcceptanceEvidenceSchema,
  REQUIRED_CERTIFICATION_JOBS,
  REQUIRED_PRIMARY_CI_JOBS,
  assertSandboxPaymentAcceptance,
  computePaymentProvenanceDigest,
  evidenceIsCurrent,
  fetchGithubCiRun,
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

  it("rejects PARITY evidence when deployment SHAs differ from claimed releaseSha, while accepting matching SHAs including query", () => {
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
      querySha: releaseSha,
      vercelDeploymentId: "dpl_5Dq9XL1B5eSp3VneVKh2mBqyg9rR",
      webDeploymentId: "545fd6ec-13d6-4d33-9f31-073f1ea3440e",
      operationsDeploymentId: "98beae70-56e2-426f-87e2-955c56fda0e5",
      queryDeploymentId: "266e4ccf-ac8e-4bff-8362-a925597debe0",
      protectedDataAuditReference: "audit-receipt-001",
      protectedDataUnchanged: true as const,
    };
    expect(AcceptanceEvidenceSchema.safeParse(baseParity).success).toBe(true);
    expect(AcceptanceEvidenceSchema.safeParse({ ...baseParity, vercelSha: "b".repeat(40) }).success).toBe(false);
    expect(AcceptanceEvidenceSchema.safeParse({ ...baseParity, webSha: "b".repeat(40) }).success).toBe(false);
    expect(AcceptanceEvidenceSchema.safeParse({ ...baseParity, operationsSha: "b".repeat(40) }).success).toBe(false);
    expect(AcceptanceEvidenceSchema.safeParse({ ...baseParity, querySha: "b".repeat(40) }).success).toBe(false);
  });

  it("assigns HUMAN_ATTESTED mode for LIVE acceptance and enforces financialAuthorizationReference in production", async () => {
    const liveEvidence = {
      kind: "LIVE" as const,
      key: "settlement_acceptance" as const,
      releaseSha,
      observedAt,
      expiresAt,
      evidenceReference: "finance:settlement-proof-01",
      reason: "Finance signed off settled order ledger reconciliation",
      genuineOperatorAcceptance: true as const,
      financialAuthorizationReference: "FIN-AUTH-2026-001",
    };

    const verified = await verifyAcceptanceProvenanceWithAdapters(liveEvidence, {
      now: reviewNow,
      requireServerVerification: true,
      env: { NODE_ENV: "production", KT_DATABASE_CLASSIFICATION: "production", RAILWAY_GIT_COMMIT_SHA: releaseSha },
    });
    expect(verified.verificationMode).toBe("HUMAN_ATTESTED");
    expect(verified.provenanceDigest).toMatch(/^[a-f0-9]{64}$/);

    const record = {
      evidence: liveEvidence,
      version: 2,
      status: "APPROVED" as const,
      authorId: "admin-1",
      approverId: "admin-2",
      approvedAt: observedAt,
      verificationMode: verified.verificationMode,
      provenanceDigest: verified.provenanceDigest,
    };
    expect(evidenceIsCurrent(record, releaseSha, reviewNow, { requireServerVerifiedInProd: true })).toBe(true);
    expect(
      evidenceIsCurrent(
        { ...record, verificationMode: "LOCAL_TEST_BOUNDARY" },
        releaseSha,
        reviewNow,
        { requireServerVerifiedInProd: true },
      ),
    ).toBe(false);
    expect(
      evidenceIsCurrent(
        { ...record, evidence: { ...liveEvidence, financialAuthorizationReference: null } },
        releaseSha,
        reviewNow,
        { requireServerVerifiedInProd: true },
      ),
    ).toBe(false);
  });

  it("verifies paginated 26 certification jobs, 10 primary CI jobs, and ZIP test counts via fetchGithubCiRun", async () => {
    const buildZipBuffer = (entryName: string, body: string) => {
      const nameBuf = Buffer.from(entryName, "utf8");
      const contentBuf = Buffer.from(body, "utf8");
      const local = Buffer.alloc(30 + nameBuf.length + contentBuf.length);
      local.writeUInt32LE(0x04034b50, 0);
      local.writeUInt16LE(20, 4);
      local.writeUInt16LE(0, 8);
      local.writeUInt32LE(contentBuf.length, 18);
      local.writeUInt32LE(contentBuf.length, 22);
      local.writeUInt16LE(nameBuf.length, 26);
      nameBuf.copy(local, 30);
      contentBuf.copy(local, 30 + nameBuf.length);

      const cd = Buffer.alloc(46 + nameBuf.length);
      cd.writeUInt32LE(0x02014b50, 0);
      cd.writeUInt16LE(20, 4);
      cd.writeUInt16LE(20, 6);
      cd.writeUInt16LE(0, 10);
      cd.writeUInt32LE(contentBuf.length, 20);
      cd.writeUInt32LE(contentBuf.length, 24);
      cd.writeUInt16LE(nameBuf.length, 28);
      cd.writeUInt32LE(0, 42);
      nameBuf.copy(cd, 46);

      const eocd = Buffer.alloc(22);
      eocd.writeUInt32LE(0x06054b50, 0);
      eocd.writeUInt16LE(1, 8);
      eocd.writeUInt16LE(1, 10);
      eocd.writeUInt32LE(cd.length, 12);
      eocd.writeUInt32LE(local.length, 16);
      return Buffer.concat([local, cd, eocd]);
    };

    const certJobsPage1 = REQUIRED_CERTIFICATION_JOBS.slice(0, 10).map((name) => ({ name, conclusion: "success" }));
    const certJobsPage2 = REQUIRED_CERTIFICATION_JOBS.slice(10).map((name) => ({ name, conclusion: "success" }));
    const fillerJobs = Array.from({ length: 90 }, (_, idx) => ({ name: `helper-${idx}`, conclusion: "success" }));
    const zipBytes = buildZipBuffer("reports/test-coverage.json", JSON.stringify({ numPassedTests: 5933 }));

    const mockFetch = vi.fn(async (input: string | URL | Request) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      if (url.endsWith("/actions/runs/45352739746")) {
        return new Response(
          JSON.stringify({
            head_sha: releaseSha,
            head_branch: "main",
            path: ".github/workflows/production-certification.yml",
            status: "completed",
            conclusion: "success",
            updated_at: "2026-10-07T00:04:00.000Z",
            run_attempt: 1,
          }),
          { status: 200 },
        );
      }
      if (url.includes("/runs/45352739746/attempts/1/jobs") && new URL(url).searchParams.get("page") === "1") {
        return new Response(JSON.stringify({ total_count: 116, jobs: [...certJobsPage1, ...fillerJobs] }), { status: 200 });
      }
      if (url.includes("/runs/45352739746/attempts/1/jobs") && new URL(url).searchParams.get("page") === "2") {
        return new Response(JSON.stringify({ total_count: 116, jobs: certJobsPage2 }), { status: 200 });
      }
      if (url.includes("/workflows/ci.yml/runs")) {
        return new Response(
          JSON.stringify({
            workflow_runs: [{ id: 45352739658, head_sha: releaseSha, head_branch: "main", status: "completed", conclusion: "success", run_attempt: 1 }],
          }),
          { status: 200 },
        );
      }
      if (url.includes("/runs/45352739658/attempts/1/jobs")) {
        return new Response(
          JSON.stringify({ total_count: REQUIRED_PRIMARY_CI_JOBS.length, jobs: REQUIRED_PRIMARY_CI_JOBS.map((name) => ({ name, conclusion: "success" })) }),
          { status: 200 },
        );
      }
      if (url.includes("/runs/45352739746/artifacts")) {
        return new Response(
          JSON.stringify({
            artifacts: [{ name: "certification-quality", expired: false, archive_download_url: "https://api.github.com/artifacts/1/zip" }],
          }),
          { status: 200 },
        );
      }
      if (url === "https://api.github.com/artifacts/1/zip") {
        return new Response(zipBytes, { status: 200 });
      }
      return new Response("not found", { status: 404 });
    }) as unknown as typeof fetch;

    const info = await fetchGithubCiRun("45352739746", "ghp_test_token", releaseSha, mockFetch);
    expect(info.missingJobs).toEqual([]);
    expect(info.primaryCiVerified).toBe(true);
    expect(info.verifiedTestsPassed).toBe(5933);
    expect(info.jobsPassed).toBe(116);

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

    const verified = await verifyAcceptanceProvenanceWithAdapters(ciEvidence, {
      now: reviewNow,
      requireServerVerification: true,
      env: { NODE_ENV: "production", KT_DATABASE_CLASSIFICATION: "production", RAILWAY_GIT_COMMIT_SHA: releaseSha },
      adapters: { verifyCiRun: async () => info },
    });
    expect(verified.verificationMode).toBe("SERVER_VERIFIED");

    // Reject if claimed testsPassed differs from artifact report
    await expect(
      verifyAcceptanceProvenanceWithAdapters({ ...ciEvidence, testsPassed: 5934 }, {
        now: reviewNow,
        requireServerVerification: true,
        env: { NODE_ENV: "production", KT_DATABASE_CLASSIFICATION: "production", RAILWAY_GIT_COMMIT_SHA: releaseSha },
        adapters: { verifyCiRun: async () => info },
      }),
    ).rejects.toMatchObject({ code: "CI_VERIFICATION_MISMATCH", status: 409 });

    // Reject PARITY when querySha mismatches even if vercel/web/operations match
    const parityEvidence = {
      kind: "PARITY" as const,
      key: "production_deployment_sha_parity" as const,
      releaseSha,
      observedAt,
      expiresAt,
      evidenceReference: "audit:parity-2",
      reason: "Verify production parity across Vercel and 3 Railway services",
      vercelSha: releaseSha,
      webSha: releaseSha,
      operationsSha: releaseSha,
      querySha: releaseSha,
      vercelDeploymentId: "dpl_5Dq9XL1B5eSp3VneVKh2mBqyg9rR",
      webDeploymentId: "545fd6ec-13d6-4d33-9f31-073f1ea3440e",
      operationsDeploymentId: "98beae70-56e2-426f-87e2-955c56fda0e5",
      queryDeploymentId: "266e4ccf-ac8e-4bff-8362-a925597debe0",
      protectedDataAuditReference: "audit-receipt-002",
      protectedDataUnchanged: true as const,
    };
    const validParity = {
      vercelSha: releaseSha,
      vercelState: "READY",
      webSha: releaseSha,
      webStatus: "SUCCESS",
      operationsSha: releaseSha,
      operationsStatus: "SUCCESS",
      querySha: releaseSha,
      queryStatus: "SUCCESS",
      auditReference: "audit-receipt-002",
      auditReleaseSha: releaseSha,
      auditDatabase: "kt_prod",
      auditClassification: "production",
      auditBaselinePresent: true,
      auditInventoryComplete: true,
      auditParityEligible: true,
      protectedDataUnchanged: true,
      leastPrivilege: true,
      auditDigest: "a".repeat(64),
      auditObservedAt: observedAt,
      auditExpiresAt: expiresAt,
    };

    await expect(
      verifyAcceptanceProvenanceWithAdapters(parityEvidence, {
        now: reviewNow,
        requireServerVerification: true,
        env: { NODE_ENV: "production", KT_DATABASE_CLASSIFICATION: "production", RAILWAY_GIT_COMMIT_SHA: releaseSha },
        adapters: {
          verifyParity: async () => ({ ...validParity, querySha: "d".repeat(40) }),
        },
      }),
    ).rejects.toMatchObject({ code: "PARITY_VERIFICATION_MISMATCH", status: 409 });

    for (const badPatch of [
      { leastPrivilege: false },
      { auditBaselinePresent: false },
      { auditInventoryComplete: false },
      { auditParityEligible: false },
      { auditExpiresAt: "2026-10-07T00:08:00.000Z" },
    ]) {
      await expect(
        verifyAcceptanceProvenanceWithAdapters(parityEvidence, {
          now: reviewNow,
          requireServerVerification: true,
          env: { NODE_ENV: "production", KT_DATABASE_CLASSIFICATION: "production", RAILWAY_GIT_COMMIT_SHA: releaseSha },
          adapters: {
            verifyParity: async () => ({ ...validParity, ...badPatch }),
          },
        }),
      ).rejects.toMatchObject({ code: "PARITY_VERIFICATION_MISMATCH", status: 409 });
    }
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
