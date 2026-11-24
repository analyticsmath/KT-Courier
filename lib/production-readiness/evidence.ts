import { createHash } from "node:crypto";
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
        vercelDeploymentId: z.string().regex(/^dpl_[A-Za-z0-9]+$/),
        webDeploymentId: z.uuid(),
        operationsDeploymentId: z.uuid(),
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
    if (v.kind === "PARITY" && (v.vercelSha !== v.releaseSha || v.webSha !== v.releaseSha || v.operationsSha !== v.releaseSha)) {
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
  verificationMode: z.enum(["SERVER_VERIFIED", "LOCAL_TEST_BOUNDARY"]).optional(),
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
  if (enforceServer && record.verificationMode !== "SERVER_VERIFIED") {
    return false;
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

export type VerifiedCiRunInfo = Readonly<{
  headSha: string;
  status: string;
  conclusion: string;
  completedAt: string;
  jobsPassed: number;
  skippedJobs: number;
}>;

export type VerifiedParityInfo = Readonly<{
  vercelSha: string;
  vercelState: string;
  webSha: string;
  webStatus: string;
  operationsSha: string;
  operationsStatus: string;
  auditReleaseSha: string;
  protectedDataUnchanged: boolean;
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

async function fetchGithubCiRun(runId: string, token: string): Promise<VerifiedCiRunInfo> {
  const headers = {
    accept: "application/vnd.github+json",
    authorization: `Bearer ${token}`,
    "user-agent": "KT-Courier-Acceptance-Verifier",
  };
  const [runRes, jobsRes] = await Promise.all([
    fetch(`https://api.github.com/repos/analyticsmath/KT-Courier/actions/runs/${encodeURIComponent(runId)}`, {
      headers,
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
    }),
    fetch(`https://api.github.com/repos/analyticsmath/KT-Courier/actions/runs/${encodeURIComponent(runId)}/jobs?per_page=100`, {
      headers,
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
    }),
  ]);
  if (!runRes.ok || !jobsRes.ok) {
    throw new PlatformError("CI_VERIFICATION_UNAVAILABLE", "Unable to query GitHub Actions run status.", 502);
  }
  const runJson = (await runRes.json()) as { head_sha?: string; status?: string; conclusion?: string; updated_at?: string };
  const jobsJson = (await jobsRes.json()) as { jobs?: Array<{ conclusion?: string | null }> };
  const jobs = jobsJson.jobs ?? [];
  return {
    headSha: String(runJson.head_sha ?? ""),
    status: String(runJson.status ?? ""),
    conclusion: String(runJson.conclusion ?? ""),
    completedAt: String(runJson.updated_at ?? new Date().toISOString()),
    jobsPassed: jobs.filter((j) => j.conclusion === "success").length,
    skippedJobs: jobs.filter((j) => j.conclusion === "skipped").length,
  };
}

export async function verifyAcceptanceProvenanceWithAdapters(
  evidence: AcceptanceEvidence,
  options?: AcceptanceVerificationOptions,
): Promise<{ verificationMode: "SERVER_VERIFIED" | "LOCAL_TEST_BOUNDARY"; provenanceDigest: string | null }> {
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
    const digest = createHash("sha256").update(`${evidence.releaseSha}:${evidence.key}:${evidence.evidenceReference}`).digest("hex");
    return { verificationMode: prod ? "SERVER_VERIFIED" : "LOCAL_TEST_BOUNDARY", provenanceDigest: digest };
  }

  const mustVerifyRemotely = options?.requireServerVerification ?? prod;

  if (evidence.kind === "CI") {
    const runId = evidence.runUrl.split("/").pop() ?? "";
    const githubToken = (env.GITHUB_RELEASE_READ_TOKEN ?? "").trim();
    const verifier =
      options?.adapters?.verifyCiRun ??
      (githubToken ? ({ runId: id }: { runId: string; releaseSha: string }) => fetchGithubCiRun(id, githubToken) : null);

    if (!verifier) {
      if (mustVerifyRemotely) {
        throw new PlatformError("CI_VERIFICATION_UNAVAILABLE", "Independent GitHub Actions CI verification authority is not configured.", 409);
      }
      return { verificationMode: "LOCAL_TEST_BOUNDARY", provenanceDigest: null };
    }

    const verified = await verifier({ runId, releaseSha: evidence.releaseSha });
    if (
      verified.headSha !== evidence.releaseSha ||
      verified.status !== "completed" ||
      verified.conclusion !== "success" ||
      verified.skippedJobs !== 0 ||
      verified.jobsPassed <= 0 ||
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
    protectedDataAuditReference: evidence.protectedDataAuditReference,
  });
  if (
    verifiedParity.vercelSha !== evidence.releaseSha ||
    verifiedParity.vercelState !== "READY" ||
    verifiedParity.webSha !== evidence.releaseSha ||
    verifiedParity.webStatus !== "SUCCESS" ||
    verifiedParity.operationsSha !== evidence.releaseSha ||
    verifiedParity.operationsStatus !== "SUCCESS" ||
    verifiedParity.auditReleaseSha !== evidence.releaseSha ||
    verifiedParity.protectedDataUnchanged !== true ||
    verifiedParity.leastPrivilege !== true
  ) {
    throw new PlatformError("PARITY_VERIFICATION_MISMATCH", "Deployment SHAs or protected-row audit receipt failed independent verification.", 409);
  }
  return { verificationMode: "SERVER_VERIFIED", provenanceDigest: verifiedParity.auditDigest };
}

async function assertSandboxNotPreviouslyRevokedOrReplayed(
  tx: Prisma.TransactionClient,
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
  const historyRows = await tx.adminActivityLog.findMany({
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

async function loadSandboxCandidate(tx: Prisma.TransactionClient, evidence: SandboxEvidence): Promise<SandboxAcceptanceCandidate | null> {
  const payment = await tx.payment.findUnique({ where: { publicReference: evidence.paymentReference }, select: sandboxPaymentSelection });
  if (payment) return payment;

  const sandboxVerif = await tx.paystackSandboxVerification.findUnique({
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

async function validateSandboxEvidence(
  tx: Prisma.TransactionClient,
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
  await assertSandboxNotPreviouslyRevokedOrReplayed(tx, key, evidence, priorRecord);

  const candidate = await loadSandboxCandidate(tx, evidence);
  assertSandboxPaymentAcceptance(candidate, evidence);

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
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`;
    const prior = await tx.systemSetting.findUnique({ where: { key } });
    const parsedPrior = prior ? parseAcceptanceRecord(prior.value) : null;
    const version = parsedPrior ? parsedPrior.version : 0;
    if (version !== data.expectedVersion) throw new PlatformError("EVIDENCE_CONFLICT", "Refresh the acceptance evidence before saving.", 409);

    await validateSandboxEvidence(tx, key, data.evidence, parsedPrior, options);
    const provenanceCheck = await verifyAcceptanceProvenanceWithAdapters(data.evidence, options);

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
    let verificationMode = prior.verificationMode;
    let provenanceDigest = prior.provenanceDigest;
    if (data.action === "APPROVE") {
      await validateSandboxEvidence(tx, key, prior.evidence, prior, options);
      const provenanceCheck = await verifyAcceptanceProvenanceWithAdapters(prior.evidence, options);
      verificationMode = provenanceCheck.verificationMode;
      provenanceDigest = provenanceCheck.provenanceDigest;
    }
    const now = options?.now ?? new Date();
    const next: AcceptanceRecord = {
      ...prior,
      version: prior.version + 1,
      status: data.action === "APPROVE" ? "APPROVED" : "REVOKED",
      approverId: actorId,
      approvedAt: now.toISOString(),
      verificationMode,
      provenanceDigest,
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
