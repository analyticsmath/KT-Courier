import { createHash } from "node:crypto";
import { inflateRawSync } from "node:zlib";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { PlatformError } from "@/lib/client-platform/contracts";
import { PaystackClient } from "@/lib/payments/providers/paystack/paystack-client";
import {
  computeSandboxProvenanceDigest,
  resolveCurrentServerReleaseSha,
  resolveSandboxAcceptanceConfiguration,
} from "@/lib/payments/sandbox-acceptance.service";
import { classifyRuntimeEnvironment } from "@/lib/runtime/deployment-classification";

export { computeSandboxProvenanceDigest as computePaymentProvenanceDigest };

export const acceptanceKeys = [
  "vendor_onboarding_acceptance",
  "driver_onboarding_acceptance",
  "driver_gps_acceptance",
  "pod_otp_acceptance",
  "payment_integration_acceptance",
  "settlement_acceptance",
  "refund_acceptance",
  "payout_acceptance",
  "current_ci_certification",
  "production_deployment_sha_parity",
] as const;

export type AcceptanceKey = (typeof acceptanceKeys)[number];
const sha = z.string().regex(/^[a-f0-9]{40}$/);
const ALLOWED_SANDBOX_SUBJECTS = new Set(["COURIER_ORDER", "MARKETPLACE_CHECKOUT", "SANDBOX_ACCEPTANCE"]);

const common = {
  releaseSha: sha,
  observedAt: z.iso.datetime(),
  expiresAt: z.iso.datetime(),
  evidenceReference: z.string().regex(/^[A-Za-z0-9:/._-]{8,250}$/),
  reason: z.string().trim().min(10).max(500),
};

export const AcceptanceEvidenceSchema = z
  .discriminatedUnion("kind", [
    z
      .object({
        ...common,
        kind: z.literal("LIVE"),
        key: z.enum([
          "vendor_onboarding_acceptance",
          "driver_onboarding_acceptance",
          "driver_gps_acceptance",
          "pod_otp_acceptance",
          "payment_integration_acceptance",
          "settlement_acceptance",
          "refund_acceptance",
          "payout_acceptance",
        ]),
        genuineOperatorAcceptance: z.literal(true),
        financialAuthorizationReference: z.string().regex(/^[A-Za-z0-9:/._-]{8,150}$/).nullable(),
      })
      .strict(),
    z
      .object({
        ...common,
        kind: z.literal("SANDBOX"),
        key: z.literal("payment_integration_acceptance"),
        genuineOperatorAcceptance: z.literal(true),
        provider: z.literal("PAYSTACK"),
        paymentReference: z.string().regex(/^pay_[A-Za-z0-9_-]{8,100}$/),
        amount: z
          .string()
          .regex(/^[0-9]+\.[0-9]{2}$/)
          .refine((v) => v.length <= 20 && /^[0-9]+\.[0-9]{2}$/.test(v) && new Prisma.Decimal(v).gt(0)),
        currency: z.literal("ZAR"),
      })
      .strict(),
    z
      .object({
        ...common,
        kind: z.literal("CI"),
        key: z.literal("current_ci_certification"),
        runUrl: z.string().regex(/^https:\/\/github\.com\/analyticsmath\/KT-Courier\/actions\/runs\/\d+$/),
        conclusion: z.literal("SUCCESS"),
        skippedCriticalTests: z.literal(0),
        testsPassed: z.number().int().positive(),
      })
      .strict(),
    z
      .object({
        ...common,
        kind: z.literal("PARITY"),
        key: z.literal("production_deployment_sha_parity"),
        vercelSha: sha,
        webSha: sha,
        operationsSha: sha,
        querySha: sha,
        vercelDeploymentId: z.string().regex(/^dpl_[A-Za-z0-9]+$/),
        webDeploymentId: z.uuid(),
        operationsDeploymentId: z.uuid(),
        queryDeploymentId: z.uuid(),
        protectedDataAuditReference: z.string().regex(/^[A-Za-z0-9:/._-]{8,250}$/),
        protectedDataUnchanged: z.literal(true),
      })
      .strict(),
  ])
  .superRefine((v, context) => {
    if (new Date(v.observedAt) > new Date() || new Date(v.expiresAt) <= new Date(v.observedAt)) {
      context.addIssue({ code: "custom", message: "Evidence requires an observed time and a later expiry." });
    }
    if (v.kind === "LIVE" && v.financialAuthorizationReference === null) {
      context.addIssue({ code: "custom", message: "Financial authorization reference is required for real-money acceptance." });
    }
    if (
      v.kind === "PARITY" &&
      (v.vercelSha !== v.releaseSha ||
        v.webSha !== v.releaseSha ||
        v.operationsSha !== v.releaseSha ||
        v.querySha !== v.releaseSha)
    ) {
      context.addIssue({ code: "custom", message: "Deployment SHAs must all match the release SHA." });
    }
  });

export type AcceptanceEvidence = z.infer<typeof AcceptanceEvidenceSchema>;
export const AcceptanceDraftSchema = z.object({ evidence: AcceptanceEvidenceSchema, expectedVersion: z.number().int().nonnegative() }).strict();
export const AcceptanceReviewSchema = z
  .object({
    key: z.enum(acceptanceKeys),
    expectedVersion: z.number().int().positive(),
    action: z.enum(["APPROVE", "REVOKE"]),
    reason: z.string().trim().min(10).max(500),
  })
  .strict();

const AcceptanceRecordSchema = z.object({
  evidence: AcceptanceEvidenceSchema,
  version: z.number().int().positive(),
  status: z.enum(["DRAFT", "APPROVED", "REVOKED"]),
  authorId: z.string().min(1),
  approverId: z.string().nullable(),
  approvedAt: z.iso.datetime().nullable(),
  verificationMode: z.enum(["SERVER_VERIFIED", "HUMAN_ATTESTED", "LOCAL_TEST_BOUNDARY"]).optional(),
  provenanceDigest: z.string().regex(/^[a-f0-9]{64}$/).nullable().optional(),
});

export type AcceptanceRecord = z.infer<typeof AcceptanceRecordSchema>;

const LegacyAcceptanceSchema = z.object({
  evidence: z.object({
    kind: z.literal("SANDBOX"),
    key: z.literal("live_paid_order_acceptance"),
    releaseSha: sha,
    observedAt: z.iso.datetime(),
    expiresAt: z.iso.datetime(),
    evidenceReference: z.string().min(1),
    reason: z.string().min(1),
    genuineOperatorAcceptance: z.literal(true),
    provider: z.literal("PAYSTACK"),
    paymentReference: z.string().min(1),
    amount: z.string().min(1),
    currency: z.literal("ZAR"),
  }),
  version: z.number().int().positive(),
  status: z.enum(["DRAFT", "APPROVED", "REVOKED"]),
  authorId: z.string().min(1),
  approverId: z.string().nullable(),
  approvedAt: z.iso.datetime().nullable(),
});

export const acceptanceStorageKey = (key: AcceptanceKey | "live_paid_order_acceptance") =>
  key === "payment_integration_acceptance" || key === "live_paid_order_acceptance"
    ? "production_acceptance_live_paid_order_acceptance"
    : `production_acceptance_${key}`;

export function parseAcceptanceRecord(value: unknown): AcceptanceRecord {
  const modern = AcceptanceRecordSchema.safeParse(value);
  if (modern.success) return modern.data;
  const legacy = LegacyAcceptanceSchema.parse(value);
  return { ...legacy, evidence: { ...legacy.evidence, key: "payment_integration_acceptance" } };
}

export async function listAcceptanceEvidence(): Promise<AcceptanceRecord[]> {
  const rows = await prisma.systemSetting.findMany({ where: { key: { startsWith: "production_acceptance_" } } });
  return rows.map((row) => parseAcceptanceRecord(row.value));
}

export function isProductionAcceptanceRuntime(env: Record<string, string | undefined> = process.env): boolean {
  const runtime = classifyRuntimeEnvironment(env);
  return env.KT_DATABASE_CLASSIFICATION?.trim().toLowerCase() === "production" || runtime.runtime === "production" || env.NODE_ENV === "production";
}

export function evidenceIsCurrent(
  record: AcceptanceRecord | undefined,
  releaseSha: string | undefined,
  now = new Date(),
  options?: { env?: Record<string, string | undefined>; requireServerVerifiedInProd?: boolean },
) {
  if (!record) return false;
  if (
    record.status !== "APPROVED" ||
    !record.approverId ||
    record.approverId === record.authorId ||
    !record.approvedAt ||
    !releaseSha ||
    record.evidence.releaseSha !== releaseSha
  ) {
    return false;
  }
  const observedAt = new Date(record.evidence.observedAt);
  const expiresAt = new Date(record.evidence.expiresAt);
  if (observedAt > now || expiresAt <= now) return false;

  const env = options?.env ?? process.env;
  const enforceServer = options?.requireServerVerifiedInProd ?? isProductionAcceptanceRuntime(env);
  if (enforceServer) {
    if (record.evidence.kind === "LIVE") {
      if (record.verificationMode !== "HUMAN_ATTESTED" && record.verificationMode !== "SERVER_VERIFIED") {
        return false;
      }
      if (!record.evidence.financialAuthorizationReference) {
        return false;
      }
    } else if (record.verificationMode !== "SERVER_VERIFIED") {
      return false;
    }
  }
  return true;
}

const sandboxPaymentSelection = {
  publicReference: true,
  provider: true,
  status: true,
  amount: true,
  currency: true,
  subjectType: true,
  createdAt: true,
  successLedgerJournalId: true,
  providerConfirmedAt: true,
  reconciliationStatus: true,
  successfulAttempt: {
    select: {
      publicReference: true,
      provider: true,
      status: true,
      providerEnvironment: true,
      amount: true,
      currency: true,
      providerReference: true,
      providerConfirmedAt: true,
    },
  },
  releaseProvenance: {
    select: {
      paymentReference: true,
      attemptId: true,
      ledgerJournalId: true,
      provider: true,
      providerEnvironment: true,
      subjectType: true,
      subjectNamespace: true,
      providerReference: true,
      amount: true,
      currency: true,
      releaseSha: true,
      deploymentId: true,
      paymentCreatedAt: true,
      providerConfirmedAt: true,
      resultDigest: true,
    },
  },
} as const;

export type SandboxProvenanceSnapshot = Readonly<{
  paymentReference: string;
  attemptId?: string | null;
  ledgerJournalId: string;
  provider: string;
  providerEnvironment: string;
  subjectType: string;
  subjectNamespace: string;
  providerReference: string;
  amount: Prisma.Decimal;
  currency: string;
  releaseSha: string;
  deploymentId?: string | null;
  paymentCreatedAt: Date;
  providerConfirmedAt: Date;
  resultDigest: string;
  revokedAt?: Date | null;
}>;

export type SandboxAcceptanceCandidate = Readonly<{
  publicReference?: string;
  provider: string | null;
  status: string;
  amount: Prisma.Decimal;
  currency: string;
  subjectType?: string | null;
  createdAt?: Date;
  successLedgerJournalId: string | null;
  providerConfirmedAt: Date | null;
  reconciliationStatus: string;
  successfulAttempt: Readonly<{
    publicReference?: string | null;
    provider: string;
    status: string;
    providerEnvironment: string | null;
    amount: Prisma.Decimal;
    currency: string;
    providerReference: string | null;
    providerConfirmedAt: Date | null;
  }> | null;
  releaseProvenance?: SandboxProvenanceSnapshot | null;
}>;

type SandboxEvidence = Extract<AcceptanceEvidence, { kind: "SANDBOX" }>;

export function assertSandboxPaymentAcceptance(payment: SandboxAcceptanceCandidate | null, evidence: SandboxEvidence) {
  const attempt = payment?.successfulAttempt;
  if (
    !payment ||
    payment.provider !== "PAYSTACK" ||
    payment.status !== "SUCCEEDED" ||
    payment.currency !== evidence.currency ||
    !payment.amount.equals(evidence.amount) ||
    !payment.successLedgerJournalId ||
    !payment.providerConfirmedAt ||
    payment.reconciliationStatus === "REQUIRED" ||
    !attempt ||
    attempt.provider !== "PAYSTACK" ||
    attempt.status !== "SUCCEEDED" ||
    attempt.providerEnvironment !== "SANDBOX" ||
    !attempt.providerReference ||
    !attempt.providerConfirmedAt ||
    attempt.currency !== evidence.currency ||
    !attempt.amount.equals(evidence.amount)
  ) {
    throw new PlatformError(
      "SANDBOX_PAYMENT_EVIDENCE_INVALID",
      "Select a verified Paystack sandbox payment with matching amount, currency and canonical ledger confirmation.",
      409,
    );
  }

  const provenance = payment.releaseProvenance;
  if (
    !provenance ||
    provenance.revokedAt != null ||
    provenance.releaseSha !== evidence.releaseSha ||
    provenance.paymentReference !== evidence.paymentReference ||
    provenance.ledgerJournalId !== payment.successLedgerJournalId ||
    provenance.provider !== "PAYSTACK" ||
    provenance.providerEnvironment !== "SANDBOX" ||
    provenance.providerReference !== attempt.providerReference ||
    !provenance.amount.equals(evidence.amount) ||
    provenance.currency !== evidence.currency ||
    !ALLOWED_SANDBOX_SUBJECTS.has(provenance.subjectType) ||
    (payment.subjectType && payment.subjectType !== provenance.subjectType)
  ) {
    throw new PlatformError(
      "SANDBOX_PAYMENT_EVIDENCE_INVALID",
      "Select a verified Paystack sandbox payment bound via immutable provenance to the target release SHA.",
      409,
    );
  }

  const observedAtMs = new Date(evidence.observedAt).getTime();
  const confirmedAtMs = payment.providerConfirmedAt.getTime();
  const provenanceConfirmedMs = provenance.providerConfirmedAt.getTime();
  if (observedAtMs < confirmedAtMs || observedAtMs < provenanceConfirmedMs) {
    throw new PlatformError(
      "SANDBOX_PAYMENT_EVIDENCE_INVALID",
      "Acceptance observation timestamp must be at or after provider confirmation.",
      409,
    );
  }

  const expectedDigest = computeSandboxProvenanceDigest({
    paymentReference: provenance.paymentReference,
    attemptReference: provenance.attemptId ?? attempt.publicReference ?? null,
    ledgerJournalId: provenance.ledgerJournalId,
    provider: provenance.provider,
    providerEnvironment: provenance.providerEnvironment,
    subjectType: provenance.subjectType,
    subjectNamespace: provenance.subjectNamespace,
    amount: provenance.amount.toFixed(2),
    currency: provenance.currency,
    providerReference: provenance.providerReference,
    paymentCreatedAt: provenance.paymentCreatedAt,
    providerConfirmedAt: provenance.providerConfirmedAt,
    releaseSha: provenance.releaseSha,
    deploymentId: provenance.deploymentId ?? null,
  });

  if (expectedDigest !== provenance.resultDigest) {
    throw new PlatformError(
      "SANDBOX_PAYMENT_EVIDENCE_INVALID",
      "Sandbox payment provenance digest verification failed.",
      409,
    );
  }
}

export const REQUIRED_CERTIFICATION_JOBS = Object.freeze([
  "quality",
  "postgres (docker:migration-smoke)",
  "postgres (test:integration:auth)",
  "postgres (test:integration:permissions)",
  "postgres (test:integration:orders)",
  "postgres (test:integration:pricing)",
  "postgres (test:integration:dispatch)",
  "postgres (test:integration:cross-module)",
  "postgres (test:integration:driver-operations)",
  "postgres (test:integration:ledger)",
  "postgres (test:integration:payment-foundation)",
  "postgres (test:integration:refunds)",
  "postgres (test:integration:withdrawals)",
  "postgres (test:integration:store-earnings)",
  "postgres (test:integration:driver-earnings)",
  "postgres (test:integration:marketplace-checkout)",
  "postgres (test:integration:store-orders)",
  "postgres (test:integration:storefront)",
  "postgres (test:integration:catalog)",
  "postgres (test:integration:closure)",
  "postgres (docker:gate4)",
  "redis-and-recovery",
  "recovery",
  "browser",
  "Phase 2 automated engineering verification (not live launch approval)",
  "Release authorization status (informational)",
] as const);

export const REQUIRED_PRIMARY_CI_JOBS = Object.freeze([
  "quality",
  "container-build",
  "migration-smoke",
  "pricing-integration",
  "dispatch-integration",
  "cross-module-integration",
  "ledger-integration",
  "Phase 1 Release-Critical Verification (Paystack, Invariants, Security, Processors, Refunds)",
  "Phase 1 PostgreSQL Webhook Concurrency Integration",
  "docker-runtime",
] as const);

export type VerifiedCiRunInfo = Readonly<{
  headSha: string;
  headBranch?: string;
  workflowPath?: string;
  status: string;
  conclusion: string;
  completedAt: string;
  jobsPassed: number;
  skippedJobs: number;
  missingJobs?: readonly string[];
  primaryCiVerified?: boolean;
  verifiedTestsPassed?: number | null;
}>;

export type VerifiedParityInfo = Readonly<{
  vercelSha: string;
  vercelState: string;
  webSha: string;
  webStatus: string;
  operationsSha: string;
  operationsStatus: string;
  querySha: string;
  queryStatus: string;
  auditReleaseSha: string;
  auditReference?: string;
  auditBaselineReference?: string | null;
  auditBaselinePresent: boolean;
  protectedDataUnchanged: boolean;
  auditParityEligible: boolean;
  auditInventoryComplete: boolean;
  auditDatabase?: string;
  auditClassification?: string;
  auditObservedAt: string;
  auditExpiresAt: string;
  auditChangedTables?: readonly string[];
  auditUnexpectedChangedTables?: readonly string[];
  leastPrivilege: boolean;
  auditDigest: string;
}>;

export type AcceptanceVerificationAdapters = Readonly<{
  verifyCiRun?: (input: { runId: string; releaseSha: string }) => Promise<VerifiedCiRunInfo>;
  verifyParity?: (input: {
    releaseSha: string;
    vercelDeploymentId: string;
    webDeploymentId: string;
    operationsDeploymentId: string;
    queryDeploymentId: string;
    protectedDataAuditReference: string;
  }) => Promise<VerifiedParityInfo>;
  verifySandboxPaymentWithProvider?: (input: {
    paymentReference: string;
    expectedAmountCents: number;
    expectedCurrency: string;
  }) => Promise<{ status: string; domain: string; amount: number; currency: string; reference: string }>;
}>;

export type AcceptanceVerificationOptions = Readonly<{
  now?: Date;
  env?: Record<string, string | undefined>;
  requireServerVerification?: boolean;
  adapters?: AcceptanceVerificationAdapters;
}>;

type GithubJobRow = { name?: string; status?: string; conclusion?: string | null };

async function fetchPaginatedGithubJobs(
  baseUrl: string,
  headers: Record<string, string>,
  fetchImpl: typeof fetch,
): Promise<GithubJobRow[]> {
  const allJobs: GithubJobRow[] = [];
  for (let page = 1; page <= 10; page += 1) {
    const res = await fetchImpl(`${baseUrl}?per_page=100&page=${page}`, {
      headers,
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      throw new PlatformError("CI_VERIFICATION_UNAVAILABLE", "Unable to query GitHub Actions jobs.", 502);
    }
    const payload = (await res.json()) as { total_count?: number; jobs?: GithubJobRow[] };
    const pageJobs = payload.jobs ?? [];
    allJobs.push(...pageJobs);
    if (pageJobs.length < 100 || (typeof payload.total_count === "number" && allJobs.length >= payload.total_count)) {
      break;
    }
  }
  return allJobs;
}

function extractPrimaryTestCountFromZip(zipBuffer: Buffer): number | null {
  // Parse ZIP end-of-central-directory and extract test-coverage/phase2 JSON without external packages.
  let eocdOffset = -1;
  for (let i = zipBuffer.length - 22; i >= Math.max(0, zipBuffer.length - 65557); i -= 1) {
    if (zipBuffer.readUInt32LE(i) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }
  if (eocdOffset < 0) return null;
  const cdOffset = zipBuffer.readUInt32LE(eocdOffset + 16);
  const totalEntries = zipBuffer.readUInt16LE(eocdOffset + 10);
  let cursor = cdOffset;
  for (let idx = 0; idx < totalEntries && cursor + 46 <= zipBuffer.length; idx += 1) {
    if (zipBuffer.readUInt32LE(cursor) !== 0x02014b50) break;
    const compression = zipBuffer.readUInt16LE(cursor + 10);
    const compressedSize = zipBuffer.readUInt32LE(cursor + 20);
    const nameLen = zipBuffer.readUInt16LE(cursor + 28);
    const extraLen = zipBuffer.readUInt16LE(cursor + 30);
    const commentLen = zipBuffer.readUInt16LE(cursor + 32);
    const localHeaderOffset = zipBuffer.readUInt32LE(cursor + 42);
    const fileName = zipBuffer.subarray(cursor + 46, cursor + 46 + nameLen).toString("utf8");
    cursor += 46 + nameLen + extraLen + commentLen;
    if (!/(?:^|\/)(?:test-coverage|vitest-coverage|coverage-summary)\.json$/i.test(fileName)) continue;
    if (zipBuffer.readUInt32LE(localHeaderOffset) !== 0x04034b50) continue;
    const lNameLen = zipBuffer.readUInt16LE(localHeaderOffset + 26);
    const lExtraLen = zipBuffer.readUInt16LE(localHeaderOffset + 28);
    const dataStart = localHeaderOffset + 30 + lNameLen + lExtraLen;
    const compressed = zipBuffer.subarray(dataStart, dataStart + compressedSize);
    const content = compression === 0 ? compressed : compression === 8 ? inflateRawSync(compressed) : null;
    if (!content) continue;
    try {
      const parsed = JSON.parse(content.toString("utf8")) as {
        numPassedTests?: number;
        testsPassed?: number;
        testsFailed?: number;
        testsSkipped?: number;
        status?: string;
      };
      if (
        (typeof parsed.testsFailed === "number" && parsed.testsFailed > 0) ||
        (typeof parsed.testsSkipped === "number" && parsed.testsSkipped > 0) ||
        (typeof parsed.status === "string" && parsed.status !== "PASS")
      ) {
        continue;
      }
      const count = parsed.numPassedTests ?? parsed.testsPassed;
      if (typeof count === "number" && Number.isInteger(count) && count > 0) {
        return count;
      }
    } catch {
      continue;
    }
  }
  return null;
}

export async function fetchGithubCiRun(
  runId: string,
  token: string,
  releaseSha?: string,
  fetchImpl: typeof fetch = fetch,
): Promise<VerifiedCiRunInfo> {
  const headers = {
    accept: "application/vnd.github+json",
    authorization: `Bearer ${token}`,
    "user-agent": "KT-Courier-Acceptance-Verifier",
  };
  const runRes = await fetchImpl(
    `https://api.github.com/repos/analyticsmath/KT-Courier/actions/runs/${encodeURIComponent(runId)}`,
    { headers, redirect: "error", signal: AbortSignal.timeout(10_000) },
  );
  if (!runRes.ok) {
    throw new PlatformError("CI_VERIFICATION_UNAVAILABLE", "Unable to query GitHub Actions run status.", 502);
  }
  const runJson = (await runRes.json()) as {
    head_sha?: string;
    head_branch?: string;
    path?: string;
    status?: string;
    conclusion?: string;
    updated_at?: string;
    run_attempt?: number;
  };
  const attempt = typeof runJson.run_attempt === "number" && runJson.run_attempt > 0 ? runJson.run_attempt : 1;
  const targetSha = releaseSha ?? String(runJson.head_sha ?? "");

  const [jobs, ciRunsRes, artifactsRes] = await Promise.all([
    fetchPaginatedGithubJobs(
      `https://api.github.com/repos/analyticsmath/KT-Courier/actions/runs/${encodeURIComponent(runId)}/attempts/${attempt}/jobs`,
      headers,
      fetchImpl,
    ),
    fetchImpl(
      `https://api.github.com/repos/analyticsmath/KT-Courier/actions/workflows/ci.yml/runs?head_sha=${encodeURIComponent(targetSha)}&branch=main&per_page=20`,
      { headers, redirect: "error", signal: AbortSignal.timeout(10_000) },
    ),
    fetchImpl(
      `https://api.github.com/repos/analyticsmath/KT-Courier/actions/runs/${encodeURIComponent(runId)}/artifacts?per_page=50`,
      { headers, redirect: "error", signal: AbortSignal.timeout(10_000) },
    ),
  ]);

  const succeededCertJobNames = new Set(
    jobs.filter((job) => job.conclusion === "success" && typeof job.name === "string").map((job) => job.name!),
  );
  const missingJobs = REQUIRED_CERTIFICATION_JOBS.filter((name) => !succeededCertJobNames.has(name));

  let primaryCiVerified = false;
  if (ciRunsRes.ok) {
    const ciRunsJson = (await ciRunsRes.json()) as {
      workflow_runs?: Array<{ id?: number; head_sha?: string; head_branch?: string; status?: string; conclusion?: string; run_attempt?: number }>;
    };
    const matchingCi = (ciRunsJson.workflow_runs ?? []).find(
      (r) =>
        r.head_sha === targetSha &&
        r.head_branch === "main" &&
        r.status === "completed" &&
        r.conclusion === "success" &&
        typeof r.id === "number",
    );
    if (matchingCi?.id) {
      const ciAttempt = typeof matchingCi.run_attempt === "number" && matchingCi.run_attempt > 0 ? matchingCi.run_attempt : 1;
      const ciJobs = await fetchPaginatedGithubJobs(
        `https://api.github.com/repos/analyticsmath/KT-Courier/actions/runs/${matchingCi.id}/attempts/${ciAttempt}/jobs`,
        headers,
        fetchImpl,
      );
      const ciSucceeded = new Set(
        ciJobs.filter((j) => j.conclusion === "success" && typeof j.name === "string").map((j) => j.name!),
      );
      primaryCiVerified = REQUIRED_PRIMARY_CI_JOBS.every((jobName) => ciSucceeded.has(jobName));
    }
  }

  let verifiedTestsPassed: number | null = null;
  if (artifactsRes.ok) {
    const artifactsPayload = (await artifactsRes.json()) as {
      artifacts?: Array<{ name?: string; expired?: boolean; archive_download_url?: string }>;
    };
    const qualityArtifact = (artifactsPayload.artifacts ?? []).find(
      (a) => a.name === "certification-quality" && a.expired !== true && typeof a.archive_download_url === "string",
    );
    if (qualityArtifact?.archive_download_url) {
      const zipRes = await fetchImpl(qualityArtifact.archive_download_url, {
        headers,
        redirect: "follow",
        signal: AbortSignal.timeout(15_000),
      }).catch(() => null);
      if (zipRes?.ok) {
        const buf = Buffer.from(await zipRes.arrayBuffer());
        verifiedTestsPassed = extractPrimaryTestCountFromZip(buf);
      }
    }
  }

  return {
    headSha: String(runJson.head_sha ?? ""),
    headBranch: String(runJson.head_branch ?? ""),
    workflowPath: String(runJson.path ?? ""),
    status: String(runJson.status ?? ""),
    conclusion: String(runJson.conclusion ?? ""),
    completedAt: String(runJson.updated_at ?? new Date().toISOString()),
    jobsPassed: jobs.filter((j) => j.conclusion === "success").length,
    skippedJobs: jobs.filter((j) => j.conclusion === "skipped").length,
    missingJobs,
    primaryCiVerified,
    verifiedTestsPassed,
  };
}

export async function verifyAcceptanceProvenanceWithAdapters(
  evidence: AcceptanceEvidence,
  options?: AcceptanceVerificationOptions,
): Promise<{ verificationMode: "SERVER_VERIFIED" | "HUMAN_ATTESTED" | "LOCAL_TEST_BOUNDARY"; provenanceDigest: string | null }> {
  const now = options?.now ?? new Date();
  const env = options?.env ?? process.env;
  const prod = isProductionAcceptanceRuntime(env);
  const serverSha = resolveCurrentServerReleaseSha(env);

  if (new Date(evidence.observedAt) > now || new Date(evidence.expiresAt) <= now) {
    throw new PlatformError("EVIDENCE_EXPIRED", "Acceptance evidence is expired or observed in the future.", 409);
  }
  if (serverSha && evidence.releaseSha !== serverSha) {
    throw new PlatformError("RELEASE_SHA_MISMATCH", "Acceptance evidence release SHA does not match the running release.", 409);
  }

  if (evidence.kind === "SANDBOX") {
    const digest = createHash("sha256").update(`${evidence.releaseSha}:${evidence.paymentReference}:${evidence.observedAt}`).digest("hex");
    return { verificationMode: prod || options?.adapters?.verifySandboxPaymentWithProvider ? "SERVER_VERIFIED" : "LOCAL_TEST_BOUNDARY", provenanceDigest: digest };
  }

  if (evidence.kind === "LIVE") {
    const digest = createHash("sha256")
      .update(`${evidence.releaseSha}:${evidence.key}:${evidence.evidenceReference}:${evidence.financialAuthorizationReference ?? ""}`)
      .digest("hex");
    return { verificationMode: "HUMAN_ATTESTED", provenanceDigest: digest };
  }

  const mustVerifyRemotely = options?.requireServerVerification ?? prod;

  if (evidence.kind === "CI") {
    const runId = evidence.runUrl.split("/").pop() ?? "";
    const githubToken = (env.GITHUB_RELEASE_READ_TOKEN ?? "").trim();
    const verifier =
      options?.adapters?.verifyCiRun ??
      (githubToken ? ({ runId: id, releaseSha: shaValue }: { runId: string; releaseSha: string }) => fetchGithubCiRun(id, githubToken, shaValue) : null);

    if (!verifier) {
      if (mustVerifyRemotely) {
        throw new PlatformError("CI_VERIFICATION_UNAVAILABLE", "Independent GitHub Actions CI verification authority is not configured.", 409);
      }
      return { verificationMode: "LOCAL_TEST_BOUNDARY", provenanceDigest: null };
    }

    const verified = await verifier({ runId, releaseSha: evidence.releaseSha });
    if (
      verified.headSha !== evidence.releaseSha ||
      (verified.headBranch !== undefined && verified.headBranch !== "main") ||
      (verified.workflowPath !== undefined && verified.workflowPath !== ".github/workflows/production-certification.yml") ||
      verified.status !== "completed" ||
      verified.conclusion !== "success" ||
      verified.skippedJobs !== 0 ||
      verified.jobsPassed < 26 && verified.missingJobs !== undefined ||
      verified.jobsPassed <= 0 ||
      Boolean(verified.missingJobs?.length) ||
      verified.primaryCiVerified === false ||
      (verified.verifiedTestsPassed != null && verified.verifiedTestsPassed !== evidence.testsPassed) ||
      new Date(evidence.observedAt).getTime() < new Date(verified.completedAt).getTime()
    ) {
      throw new PlatformError("CI_VERIFICATION_MISMATCH", "CI workflow evidence does not match verified GitHub run state.", 409);
    }

    const digest = createHash("sha256").update(`${runId}:${verified.headSha}:${verified.jobsPassed}:${verified.completedAt}`).digest("hex");
    return { verificationMode: "SERVER_VERIFIED", provenanceDigest: digest };
  }

  // PARITY
  const parityVerifier = options?.adapters?.verifyParity;
  if (!parityVerifier) {
    if (mustVerifyRemotely) {
      throw new PlatformError("PARITY_VERIFICATION_UNAVAILABLE", "Independent deployment parity verification adapter is not configured.", 409);
    }
    return { verificationMode: "LOCAL_TEST_BOUNDARY", provenanceDigest: null };
  }

  const verifiedParity = await parityVerifier({
    releaseSha: evidence.releaseSha,
    vercelDeploymentId: evidence.vercelDeploymentId,
    webDeploymentId: evidence.webDeploymentId,
    operationsDeploymentId: evidence.operationsDeploymentId,
    queryDeploymentId: evidence.queryDeploymentId,
    protectedDataAuditReference: evidence.protectedDataAuditReference,
  });
  const auditObsMs = Date.parse(verifiedParity.auditObservedAt);
  const auditExpMs = Date.parse(verifiedParity.auditExpiresAt);
  const matchesReference =
    verifiedParity.auditDigest === evidence.protectedDataAuditReference ||
    (typeof verifiedParity.auditReference === "string" &&
      verifiedParity.auditReference === evidence.protectedDataAuditReference);
  if (
    verifiedParity.vercelSha !== evidence.releaseSha ||
    verifiedParity.vercelState !== "READY" ||
    verifiedParity.webSha !== evidence.releaseSha ||
    verifiedParity.webStatus !== "SUCCESS" ||
    verifiedParity.operationsSha !== evidence.releaseSha ||
    verifiedParity.operationsStatus !== "SUCCESS" ||
    verifiedParity.querySha !== evidence.releaseSha ||
    verifiedParity.queryStatus !== "SUCCESS" ||
    verifiedParity.auditReleaseSha !== evidence.releaseSha ||
    verifiedParity.leastPrivilege !== true ||
    verifiedParity.auditInventoryComplete !== true ||
    verifiedParity.auditBaselinePresent !== true ||
    verifiedParity.auditParityEligible !== true ||
    !matchesReference ||
    !Number.isFinite(auditObsMs) ||
    !Number.isFinite(auditExpMs) ||
    auditObsMs > now.getTime() ||
    auditExpMs <= now.getTime() ||
    !/^[a-f0-9]{64}$/.test(verifiedParity.auditDigest)
  ) {
    throw new PlatformError("PARITY_VERIFICATION_MISMATCH", "Deployment SHAs or protected-row audit receipt failed independent verification.", 409);
  }
  return { verificationMode: "SERVER_VERIFIED", provenanceDigest: verifiedParity.auditDigest };
}

type AcceptanceDbReader = Pick<
  Prisma.TransactionClient,
  "adminActivityLog" | "payment" | "paystackSandboxVerification"
>;

async function assertSandboxNotPreviouslyRevokedOrReplayed(
  db: AcceptanceDbReader,
  key: string,
  evidence: SandboxEvidence,
  priorRecord: AcceptanceRecord | null,
) {
  if (priorRecord && priorRecord.status === "REVOKED" && priorRecord.evidence.kind === "SANDBOX" && priorRecord.evidence.paymentReference === evidence.paymentReference) {
    throw new PlatformError("SANDBOX_PAYMENT_REVOKED", "Revoked sandbox payment references cannot be reused.", 409);
  }
  if (priorRecord && priorRecord.status === "APPROVED" && priorRecord.evidence.kind === "SANDBOX" && priorRecord.evidence.paymentReference === evidence.paymentReference && priorRecord.evidence.releaseSha !== evidence.releaseSha) {
    throw new PlatformError("SANDBOX_PAYMENT_REPLAYED", "Sandbox payment reference was already consumed by another release SHA.", 409);
  }
  const historyRows = await db.adminActivityLog.findMany({
    where: { entityType: "ProductionAcceptance", entityId: key, action: "UPDATE" },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: { metadata: true },
  });
  for (const row of historyRows) {
    const after = (row.metadata as { after?: { status?: string; evidence?: { paymentReference?: string; releaseSha?: string } } } | null)?.after;
    if (after?.status === "REVOKED" && after?.evidence?.paymentReference === evidence.paymentReference) {
      throw new PlatformError("SANDBOX_PAYMENT_REVOKED", "Previously revoked sandbox payment reference cannot be reused.", 409);
    }
  }
}

async function loadSandboxCandidate(db: AcceptanceDbReader, evidence: SandboxEvidence): Promise<SandboxAcceptanceCandidate | null> {
  const payment = await db.payment.findUnique({ where: { publicReference: evidence.paymentReference }, select: sandboxPaymentSelection });
  if (payment) return payment;

  const sandboxVerif = await db.paystackSandboxVerification.findUnique({
    where: { reference: evidence.paymentReference },
    include: { releaseProvenance: true },
  });
  if (!sandboxVerif) return null;

  const amountDecimal = new Prisma.Decimal((sandboxVerif.amountCents / 100).toFixed(2));
  return {
    publicReference: sandboxVerif.reference,
    provider: "PAYSTACK",
    status: sandboxVerif.status,
    amount: amountDecimal,
    currency: sandboxVerif.currency,
    subjectType: "SANDBOX_ACCEPTANCE",
    createdAt: sandboxVerif.createdAt,
    successLedgerJournalId: sandboxVerif.ledgerJournalId,
    providerConfirmedAt: sandboxVerif.verifiedAt,
    reconciliationStatus: "CLEAR",
    successfulAttempt: sandboxVerif.providerReference
      ? {
          publicReference: sandboxVerif.attemptReference,
          provider: "PAYSTACK",
          status: sandboxVerif.status,
          providerEnvironment: sandboxVerif.providerDomain === "test" ? "SANDBOX" : "PRODUCTION",
          amount: amountDecimal,
          currency: sandboxVerif.currency,
          providerReference: sandboxVerif.providerReference,
          providerConfirmedAt: sandboxVerif.verifiedAt,
        }
      : null,
    releaseProvenance: sandboxVerif.releaseProvenance,
  };
}

async function validateSandboxEvidenceInDb(
  db: AcceptanceDbReader,
  key: string,
  evidence: AcceptanceEvidence,
  priorRecord: AcceptanceRecord | null,
  options?: AcceptanceVerificationOptions,
) {
  if (evidence.kind !== "SANDBOX") return;
  const env = options?.env ?? process.env;
  const prod = isProductionAcceptanceRuntime(env);
  if (prod && env.KT_E2E_PAYSTACK_ACCEPTANCE === "true") {
    throw new PlatformError("SANDBOX_FIXTURE_REJECTED_IN_PRODUCTION", "Disposable provider fixtures cannot certify production readiness.", 409);
  }
  await assertSandboxNotPreviouslyRevokedOrReplayed(db, key, evidence, priorRecord);
  const candidate = await loadSandboxCandidate(db, evidence);
  assertSandboxPaymentAcceptance(candidate, evidence);
}

/** Execute Paystack external HTTP check outside database transactions and advisory locks. */
async function verifySandboxEvidenceRemotely(
  evidence: AcceptanceEvidence,
  options?: AcceptanceVerificationOptions,
) {
  if (evidence.kind !== "SANDBOX") return;
  const env = options?.env ?? process.env;
  const prod = isProductionAcceptanceRuntime(env);
  const expectedAmountCents = Math.round(Number(evidence.amount) * 100);
  if (options?.adapters?.verifySandboxPaymentWithProvider) {
    const providerResult = await options.adapters.verifySandboxPaymentWithProvider({
      paymentReference: evidence.paymentReference,
      expectedAmountCents,
      expectedCurrency: evidence.currency,
    });
    if (
      providerResult.status !== "success" ||
      providerResult.domain !== "test" ||
      providerResult.amount !== expectedAmountCents ||
      providerResult.currency !== evidence.currency ||
      providerResult.reference !== evidence.paymentReference
    ) {
      throw new PlatformError("SANDBOX_PAYMENT_EVIDENCE_INVALID", "Independent provider verification did not confirm Paystack test transaction.", 409);
    }
  } else if (prod) {
    const config = resolveSandboxAcceptanceConfiguration(env);
    if (!config.eligible || !config.secretKey) {
      throw new PlatformError("SANDBOX_PROVIDER_VERIFICATION_UNAVAILABLE", "Independent Paystack sandbox credentials are required in production.", 409);
    }
    const providerResult = await new PaystackClient({ secretKey: config.secretKey }).verifyTransaction(evidence.paymentReference, AbortSignal.timeout(10_000));
    if (
      providerResult.status !== "success" ||
      providerResult.domain !== "test" ||
      providerResult.amount !== expectedAmountCents ||
      providerResult.currency !== evidence.currency ||
      providerResult.reference !== evidence.paymentReference
    ) {
      throw new PlatformError("SANDBOX_PAYMENT_EVIDENCE_INVALID", "Paystack API did not confirm this exact sandbox payment.", 409);
    }
  }
}

export async function recordAcceptanceEvidence(
  actorId: string,
  input: z.infer<typeof AcceptanceDraftSchema>,
  options?: AcceptanceVerificationOptions,
) {
  const data = AcceptanceDraftSchema.parse(input);
  const key = acceptanceStorageKey(data.evidence.key);

  // Phase 1: Preflight DB checks & external network verifications outside SQL locks.
  const prePrior = await prisma.systemSetting.findUnique({ where: { key } });
  const preParsed = prePrior ? parseAcceptanceRecord(prePrior.value) : null;
  if ((preParsed ? preParsed.version : 0) !== data.expectedVersion) {
    throw new PlatformError("EVIDENCE_CONFLICT", "Refresh the acceptance evidence before saving.", 409);
  }
  await validateSandboxEvidenceInDb(prisma, key, data.evidence, preParsed, options);
  await verifySandboxEvidenceRemotely(data.evidence, options);
  const provenanceCheck = await verifyAcceptanceProvenanceWithAdapters(data.evidence, options);

  // Phase 2: Atomic advisory-locked transaction with zero external network I/O.
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`;
    const prior = await tx.systemSetting.findUnique({ where: { key } });
    const parsedPrior = prior ? parseAcceptanceRecord(prior.value) : null;
    const version = parsedPrior ? parsedPrior.version : 0;
    if (version !== data.expectedVersion) throw new PlatformError("EVIDENCE_CONFLICT", "Refresh the acceptance evidence before saving.", 409);

    await validateSandboxEvidenceInDb(tx, key, data.evidence, parsedPrior, options);

    const value: AcceptanceRecord = {
      evidence: data.evidence,
      version: version + 1,
      status: "DRAFT",
      authorId: actorId,
      approverId: null,
      approvedAt: null,
      verificationMode: provenanceCheck.verificationMode,
      provenanceDigest: provenanceCheck.provenanceDigest,
    };
    await tx.systemSetting.upsert({
      where: { key },
      create: { key, type: "JSON", label: "Production acceptance evidence", value: value as unknown as Prisma.InputJsonValue },
      update: { value: value as unknown as Prisma.InputJsonValue },
    });
    await tx.adminActivityLog.create({
      data: {
        actorUserId: actorId,
        action: "CREATE",
        entityType: "ProductionAcceptance",
        entityId: key,
        message: data.evidence.reason,
        metadata: { before: prior?.value ?? null, after: value as unknown as Prisma.InputJsonValue },
      },
    });
    return value;
  });
}

export async function reviewAcceptanceEvidence(
  actorId: string,
  input: z.infer<typeof AcceptanceReviewSchema>,
  options?: AcceptanceVerificationOptions,
) {
  const data = AcceptanceReviewSchema.parse(input);
  const key = acceptanceStorageKey(data.key);

  // Phase 1: Preflight & external network verification outside SQL locks.
  const preRow = await prisma.systemSetting.findUnique({ where: { key } });
  const prePrior = preRow ? parseAcceptanceRecord(preRow.value) : null;
  if (!preRow || !prePrior || prePrior.version !== data.expectedVersion) {
    throw new PlatformError("EVIDENCE_CONFLICT", "Refresh before reviewing.", 409);
  }
  const preRawJson = preRow.value as { evidence?: { key?: string } } | null;
  if (data.action === "APPROVE" && preRawJson?.evidence?.key === "live_paid_order_acceptance") {
    throw new PlatformError("EVIDENCE_CONFLICT", "Legacy acceptance evidence must be replaced before review.", 409);
  }
  if (data.action === "APPROVE" && (prePrior.authorId === actorId || prePrior.status !== "DRAFT")) {
    throw new PlatformError("INDEPENDENT_REVIEW_REQUIRED", "A different authorized administrator must review the draft and its linked evidence.", 403);
  }

  let verifiedMode = prePrior.verificationMode;
  let verifiedDigest = prePrior.provenanceDigest;
  if (data.action === "APPROVE") {
    await validateSandboxEvidenceInDb(prisma, key, prePrior.evidence, prePrior, options);
    await verifySandboxEvidenceRemotely(prePrior.evidence, options);
    const provenanceCheck = await verifyAcceptanceProvenanceWithAdapters(prePrior.evidence, options);
    verifiedMode = provenanceCheck.verificationMode;
    verifiedDigest = provenanceCheck.provenanceDigest;
  }

  // Phase 2: Atomic advisory-locked transaction with zero external network I/O.
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`;
    const row = await tx.systemSetting.findUnique({ where: { key } });
    const prior = row ? parseAcceptanceRecord(row.value) : null;
    if (!row || !prior || prior.version !== data.expectedVersion) throw new PlatformError("EVIDENCE_CONFLICT", "Refresh before reviewing.", 409);
    const rawJson = row.value as { evidence?: { key?: string } } | null;
    if (data.action === "APPROVE" && rawJson?.evidence?.key === "live_paid_order_acceptance") {
      throw new PlatformError("EVIDENCE_CONFLICT", "Legacy acceptance evidence must be replaced before review.", 409);
    }
    if (data.action === "APPROVE" && (prior.authorId === actorId || prior.status !== "DRAFT")) {
      throw new PlatformError("INDEPENDENT_REVIEW_REQUIRED", "A different authorized administrator must review the draft and its linked evidence.", 403);
    }
    if (data.action === "APPROVE") {
      await validateSandboxEvidenceInDb(tx, key, prior.evidence, prior, options);
    }
    const now = options?.now ?? new Date();
    const next: AcceptanceRecord = {
      ...prior,
      version: prior.version + 1,
      status: data.action === "APPROVE" ? "APPROVED" : "REVOKED",
      approverId: actorId,
      approvedAt: now.toISOString(),
      verificationMode: verifiedMode,
      provenanceDigest: verifiedDigest,
    };
    await tx.systemSetting.update({ where: { id: row.id, updatedAt: row.updatedAt }, data: { value: next as unknown as Prisma.InputJsonValue } });
    await tx.adminActivityLog.create({
      data: {
        actorUserId: actorId,
        action: "UPDATE",
        entityType: "ProductionAcceptance",
        entityId: key,
        message: data.reason,
        metadata: { before: row.value, after: next as unknown as Prisma.InputJsonValue },
      },
    });
    return next;
  });
}
