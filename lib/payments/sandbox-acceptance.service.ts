import { createHash, randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import type { PostLedgerJournalInput } from "@/lib/ledger/types";
import { PaymentError } from "@/lib/payments/errors";
import { PaystackClient, validatePaystackAuthorizationUrl } from "@/lib/payments/providers/paystack/paystack-client";
import { verifyPaystackSignature, verifyPaystackWebhookSecretSignature } from "@/lib/payments/providers/paystack/paystack-signature";
import { classifyRuntimeEnvironment } from "@/lib/runtime/deployment-classification";
import { postLedgerJournalWithinTransaction } from "@/lib/services/ledger-posting.service";

export const PAYSTACK_SANDBOX_ACCEPTANCE_CENTS = 1000 as const;

export const SANDBOX_PLATFORM_ACCOUNTS = Object.freeze({
  walletOwnerType: "PLATFORM" as const,
  walletOwnerId: "platform-sandbox-acceptance" as const,
  cashClearingCode: "PLATFORM-SANDBOX-ACCEPTANCE-CASH-CLEARING-ZAR" as const,
  fundsHeldCode: "PLATFORM-SANDBOX-ACCEPTANCE-FUNDS-HELD-ZAR" as const,
});

const RECENT_WINDOW_MS = 24 * 60 * 60 * 1000;
const MAX_VERIFICATIONS_PER_WINDOW = 5;
const ACTIVE_STATUSES = ["CREATED", "CHECKOUT_READY", "UNKNOWN"];
const SHA_PATTERN = /^[a-f0-9]{40}$/;

type EnvRecord = Record<string, string | undefined>;
type Actor = Readonly<{ id: string; email: string }>;

export type SandboxAcceptanceResult = Readonly<{
  reference: string;
  attemptReference: string;
  status: string;
  amount: string;
  currency: "ZAR";
  providerDomain: string | null;
  releaseSha: string;
  deploymentId: string | null;
  checkoutUrl: string | null;
  ledgerJournalId: string | null;
  providerReference: string | null;
  verifiedAt: string | null;
  failureCode: string | null;
  resultDigest: string | null;
}>;

export function isProductionRuntimeEnv(source: EnvRecord = process.env): boolean {
  const runtime = classifyRuntimeEnvironment(source);
  return (
    source.KT_DATABASE_CLASSIFICATION?.trim().toLowerCase() === "production" ||
    runtime.runtime === "production" ||
    source.NODE_ENV === "production"
  );
}

export function resolveCurrentServerReleaseSha(env: EnvRecord = process.env): string | null {
  const candidate = (env.RAILWAY_GIT_COMMIT_SHA ?? env.VERCEL_GIT_COMMIT_SHA ?? "").trim().toLowerCase();
  return SHA_PATTERN.test(candidate) ? candidate : null;
}

export function resolveCurrentServerDeploymentId(env: EnvRecord = process.env): string | null {
  const candidate = (env.RAILWAY_DEPLOYMENT_ID ?? env.VERCEL_DEPLOYMENT_ID ?? "").trim();
  return candidate && candidate.length <= 120 ? candidate : null;
}

export function computeSandboxProvenanceDigest(input: {
  paymentReference: string;
  attemptReference: string | null;
  ledgerJournalId: string;
  provider: string;
  providerEnvironment: string;
  subjectType: string;
  subjectNamespace: string;
  amount: string;
  currency: string;
  providerReference: string;
  paymentCreatedAt: Date | string;
  providerConfirmedAt: Date | string;
  releaseSha: string;
  deploymentId?: string | null;
}): string {
  const canonical = JSON.stringify({
    paymentReference: input.paymentReference,
    attemptReference: input.attemptReference ?? null,
    ledgerJournalId: input.ledgerJournalId,
    provider: input.provider,
    providerEnvironment: input.providerEnvironment,
    subjectType: input.subjectType,
    subjectNamespace: input.subjectNamespace,
    amount: new Prisma.Decimal(input.amount).toFixed(2),
    currency: input.currency,
    providerReference: input.providerReference,
    paymentCreatedAt: new Date(input.paymentCreatedAt).toISOString(),
    providerConfirmedAt: new Date(input.providerConfirmedAt).toISOString(),
    releaseSha: input.releaseSha,
    deploymentId: input.deploymentId ?? null,
  });
  return createHash("sha256").update(canonical).digest("hex");
}

export function resolveSandboxAcceptanceConfiguration(
  source: EnvRecord = process.env,
): Readonly<{
  eligible: boolean;
  reason: string;
  secretKey: string | null;
  webhookSecrets: readonly string[];
  origin: string | null;
  releaseSha: string | null;
  deploymentId: string | null;
}> {
  const runtime = classifyRuntimeEnvironment(source);
  const isProdRuntime =
    source.KT_DATABASE_CLASSIFICATION?.trim().toLowerCase() === "production" ||
    runtime.runtime === "production" ||
    source.NODE_ENV === "production";

  if (isProdRuntime) {
    if (!runtime.isValid || runtime.runtime !== "production" || source.NODE_ENV !== "production") {
      return { eligible: false, reason: "PRODUCTION_RUNTIME_INVALID", secretKey: null, webhookSecrets: [], origin: null, releaseSha: null, deploymentId: null };
    }
    if (source.KT_E2E_PAYSTACK_ACCEPTANCE === "true") {
      return { eligible: false, reason: "DISPOSABLE_FIXTURE_NOT_ALLOWED_IN_PRODUCTION", secretKey: null, webhookSecrets: [], origin: null, releaseSha: null, deploymentId: null };
    }
    if (source.PAYSTACK_TEMPORARY_SANDBOX_ENABLED === "true") {
      return { eligible: false, reason: "PUBLIC_SANDBOX_OVERRIDE_MUST_REMAIN_DISABLED", secretKey: null, webhookSecrets: [], origin: null, releaseSha: null, deploymentId: null };
    }
    if (source.PAYSTACK_MODE?.trim().toLowerCase() !== "live") {
      return { eligible: false, reason: "PUBLIC_PAYSTACK_LIVE_SEPARATION_REQUIRED", secretKey: null, webhookSecrets: [], origin: null, releaseSha: null, deploymentId: null };
    }
  }

  if (source.PAYSTACK_ACCEPTANCE_SANDBOX_ENABLED !== "true") {
    return { eligible: false, reason: "SANDBOX_ACCEPTANCE_LANE_DISABLED", secretKey: null, webhookSecrets: [], origin: null, releaseSha: null, deploymentId: null };
  }

  const secretKey = (source.PAYSTACK_ACCEPTANCE_SANDBOX_SECRET_KEY ?? "").trim();
  if (!/^sk_test_[A-Za-z0-9_]{8,}$/.test(secretKey)) {
    return { eligible: false, reason: "VALID_PAYSTACK_TEST_SECRET_REQUIRED", secretKey: null, webhookSecrets: [], origin: null, releaseSha: null, deploymentId: null };
  }
  if (source.PAYSTACK_SECRET_KEY && secretKey === source.PAYSTACK_SECRET_KEY.trim()) {
    return { eligible: false, reason: "SANDBOX_KEY_MUST_DIFFER_FROM_LIVE_KEY", secretKey: null, webhookSecrets: [], origin: null, releaseSha: null, deploymentId: null };
  }

  const releaseSha = resolveCurrentServerReleaseSha(source);
  if (!releaseSha) {
    return { eligible: false, reason: "SERVER_RELEASE_SHA_UNAVAILABLE", secretKey: null, webhookSecrets: [], origin: null, releaseSha: null, deploymentId: null };
  }

  let origin: string | null = null;
  try {
    const url = new URL(source.PAYMENT_APP_ORIGIN ?? "");
    const allowedProdHost = ["ktcouriers.com", "www.ktcouriers.com"].includes(url.hostname);
    if (
      url.protocol === "https:" &&
      (!isProdRuntime || allowedProdHost) &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash &&
      (url.pathname === "/" || !url.pathname)
    ) {
      origin = url.origin;
    }
  } catch {
    origin = null;
  }
  if (!origin) {
    return { eligible: false, reason: "SANDBOX_CALLBACK_ORIGIN_REQUIRED", secretKey: null, webhookSecrets: [], origin: null, releaseSha: null, deploymentId: null };
  }

  const webhookSecrets = (source.PAYSTACK_ACCEPTANCE_SANDBOX_WEBHOOK_SECRET ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.startsWith("whsec_"));

  return {
    eligible: true,
    reason: "READY",
    secretKey,
    webhookSecrets,
    origin,
    releaseSha,
    deploymentId: resolveCurrentServerDeploymentId(source),
  };
}

export function buildSandboxAcceptanceReceiptPosting(input: {
  paymentReference: string;
  attemptReference: string;
  providerReference: string;
  releaseSha: string;
  amount: string;
  cashClearingAccountId: string;
  fundsHeldAccountId: string;
}): PostLedgerJournalInput {
  return Object.freeze({
    idempotencyKey: `sandbox-acceptance:${input.paymentReference}:complete:v1`,
    sourceReference: `sandbox-acceptance:${input.paymentReference}:complete`,
    correlationId: input.paymentReference,
    type: "EXTERNAL_PAYMENT_RECEIPT",
    currency: "ZAR",
    memo: "Isolated Paystack sandbox acceptance verification receipt; debits equal credits in sandbox namespace.",
    metadata: Object.freeze({
      sandboxAcceptance: true,
      namespace: SANDBOX_PLATFORM_ACCOUNTS.walletOwnerId,
      paymentReference: input.paymentReference,
      attemptReference: input.attemptReference,
      providerReference: input.providerReference,
      releaseSha: input.releaseSha,
      provider: "PAYSTACK",
      providerDomain: "test",
    }),
    actor: Object.freeze({ kind: "SYSTEM" as const }),
    entries: Object.freeze([
      Object.freeze({
        accountId: input.cashClearingAccountId,
        direction: "DEBIT" as const,
        amount: input.amount,
        lineCode: "SANDBOX_PAYSTACK_CASH_CLEARING",
        memo: "Isolated Paystack sandbox test receipt",
      }),
      Object.freeze({
        accountId: input.fundsHeldAccountId,
        direction: "CREDIT" as const,
        amount: input.amount,
        lineCode: "SANDBOX_PAYSTACK_FUNDS_HELD",
        memo: "Isolated Paystack sandbox acceptance offset",
      }),
    ]),
  });
}

function publicResult(
  value: {
    reference: string;
    attemptReference: string;
    status: string;
    amountCents: number;
    currency: "ZAR";
    providerDomain: string | null;
    releaseSha: string;
    deploymentId: string | null;
    checkoutUrl: string | null;
    ledgerJournalId: string | null;
    providerReference: string | null;
    verifiedAt: Date | null;
    failureCode: string | null;
    releaseProvenance?: { resultDigest: string } | null;
  },
): SandboxAcceptanceResult {
  return Object.freeze({
    reference: value.reference,
    attemptReference: value.attemptReference,
    status: value.status,
    amount: (value.amountCents / 100).toFixed(2),
    currency: value.currency,
    providerDomain: value.providerDomain,
    releaseSha: value.releaseSha,
    deploymentId: value.deploymentId,
    checkoutUrl: value.status === "CHECKOUT_READY" && value.checkoutUrl ? validatePaystackAuthorizationUrl(value.checkoutUrl) : null,
    ledgerJournalId: value.ledgerJournalId,
    providerReference: value.providerReference,
    verifiedAt: value.verifiedAt?.toISOString() ?? null,
    failureCode: value.failureCode,
    resultDigest: value.releaseProvenance?.resultDigest ?? null,
  });
}

async function ensureIsolatedSandboxLedgerAccounts(tx: Prisma.TransactionClient) {
  let wallet = await tx.wallet.findUnique({
    where: {
      ownerType_ownerId_currency: {
        ownerType: SANDBOX_PLATFORM_ACCOUNTS.walletOwnerType,
        ownerId: SANDBOX_PLATFORM_ACCOUNTS.walletOwnerId,
        currency: "ZAR",
      },
    },
  });
  if (!wallet) {
    wallet = await tx.wallet.create({
      data: {
        ownerType: SANDBOX_PLATFORM_ACCOUNTS.walletOwnerType,
        ownerId: SANDBOX_PLATFORM_ACCOUNTS.walletOwnerId,
        currency: "ZAR",
        status: "ACTIVE",
      },
    });
  }

  let cashClearing = await tx.ledgerAccount.findUnique({ where: { code: SANDBOX_PLATFORM_ACCOUNTS.cashClearingCode } });
  if (!cashClearing) {
    cashClearing = await tx.ledgerAccount.create({
      data: {
        walletId: wallet.id,
        code: SANDBOX_PLATFORM_ACCOUNTS.cashClearingCode,
        purpose: "CASH_CLEARING",
        category: "ASSET",
        currency: "ZAR",
        status: "ACTIVE",
      },
    });
  }

  let fundsHeld = await tx.ledgerAccount.findUnique({ where: { code: SANDBOX_PLATFORM_ACCOUNTS.fundsHeldCode } });
  if (!fundsHeld) {
    fundsHeld = await tx.ledgerAccount.create({
      data: {
        walletId: wallet.id,
        code: SANDBOX_PLATFORM_ACCOUNTS.fundsHeldCode,
        purpose: "HELD",
        category: "LIABILITY",
        currency: "ZAR",
        status: "ACTIVE",
      },
    });
  }

  return { cashClearing, fundsHeld };
}

export async function createSandboxGatewayVerification(
  actor: Actor,
  idempotencyKey: string,
  options?: { clientOverride?: PaystackClient; env?: EnvRecord },
): Promise<SandboxAcceptanceResult> {
  const config = resolveSandboxAcceptanceConfiguration(options?.env ?? process.env);
  if (!config.eligible || !config.secretKey || !config.origin || !config.releaseSha) {
    throw new PaymentError("PAYMENT_PROVIDER_NOT_CONFIGURED", config.reason);
  }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(idempotencyKey)) {
    throw new PaymentError("PAYMENT_METADATA_INVALID", "Invalid request identifier.");
  }
  if (!actor.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(actor.email)) {
    throw new PaymentError("PAYMENT_PAYER_EMAIL_REQUIRED", "A verified account email is required.");
  }

  const reservation = await prisma.$transaction(async (tx) => {
    const lockedUser = await tx.$queryRaw<Array<{ id: string }>>(
      Prisma.sql`SELECT "id" FROM "User" WHERE "id" = ${actor.id} FOR UPDATE`,
    );
    if (lockedUser.length !== 1) throw new PaymentError("PAYMENT_PAYER_NOT_AUTHORIZED", "Verification account no longer exists.");

    const existing = await tx.paystackSandboxVerification.findUnique({
      where: { idempotencyKey },
      include: { releaseProvenance: { select: { resultDigest: true } } },
    });
    if (existing) {
      if (existing.actorUserId !== actor.id) throw new PaymentError("PAYMENT_PAYER_NOT_AUTHORIZED", "Verification belongs to another account.");
      return { record: existing, shouldInitialize: false } as const;
    }

    const recent = await tx.paystackSandboxVerification.findMany({
      where: { actorUserId: actor.id, createdAt: { gte: new Date(Date.now() - RECENT_WINDOW_MS) } },
      orderBy: { createdAt: "desc" },
      take: MAX_VERIFICATIONS_PER_WINDOW + 1,
      include: { releaseProvenance: { select: { resultDigest: true } } },
    });
    const unresolved = recent.find((row) => ACTIVE_STATUSES.includes(row.status) && row.releaseSha === config.releaseSha);
    if (unresolved) return { record: unresolved, shouldInitialize: false } as const;
    if (recent.length >= MAX_VERIFICATIONS_PER_WINDOW) {
      throw new PaymentError("PAYMENT_PROVIDER_RATE_LIMITED", "Sandbox acceptance verification rate limit reached.");
    }

    const reference = "pay_sbox_" + randomBytes(12).toString("hex");
    const attemptReference = "patsbox_" + randomBytes(10).toString("hex");
    const record = await tx.paystackSandboxVerification.create({
      data: {
        reference,
        attemptReference,
        idempotencyKey,
        actorUserId: actor.id,
        payerEmail: actor.email.trim().toLowerCase(),
        amountCents: PAYSTACK_SANDBOX_ACCEPTANCE_CENTS,
        currency: "ZAR",
        status: "CREATED",
        releaseSha: config.releaseSha!,
        deploymentId: config.deploymentId,
      },
      include: { releaseProvenance: { select: { resultDigest: true } } },
    });

    await tx.adminActivityLog.create({
      data: {
        actorUserId: actor.id,
        action: "CREATE",
        entityType: "PaystackSandboxVerification",
        entityId: record.reference,
        message: "Initialized isolated Paystack sandbox acceptance verification.",
        metadata: { releaseSha: config.releaseSha, amountCents: PAYSTACK_SANDBOX_ACCEPTANCE_CENTS },
      },
    });

    return { record, shouldInitialize: true } as const;
  });

  const record = reservation.record;
  if (!reservation.shouldInitialize) return publicResult(record);

  const paystack = options?.clientOverride ?? new PaystackClient({ secretKey: config.secretKey });
  try {
    const result = await paystack.initializeTransaction(
      {
        email: record.payerEmail,
        amountCents: PAYSTACK_SANDBOX_ACCEPTANCE_CENTS,
        reference: record.reference,
        callbackUrl: `${config.origin}/admin/payment-providers/sandbox-acceptance?reference=${encodeURIComponent(record.reference)}`,
        metadata: {
          ktPurpose: "SANDBOX_ACCEPTANCE_VERIFICATION",
          verificationReference: record.reference,
          releaseSha: record.releaseSha,
        },
      },
      AbortSignal.timeout(12_000),
    );
    if (result.reference !== record.reference) {
      throw new PaymentError("PAYMENT_PROVIDER_REFERENCE_CONFLICT", "Paystack returned a mismatched sandbox reference.");
    }
    const url = validatePaystackAuthorizationUrl(result.authorization_url);
    await prisma.paystackSandboxVerification.updateMany({
      where: { id: record.id, status: "CREATED" },
      data: { status: "CHECKOUT_READY", checkoutUrl: url },
    });
    const updated = await prisma.paystackSandboxVerification.findUniqueOrThrow({
      where: { id: record.id },
      include: { releaseProvenance: { select: { resultDigest: true } } },
    });
    return publicResult(updated);
  } catch (error) {
    const code = error instanceof PaymentError ? error.code : "PAYSTACK_SANDBOX_INITIALIZE_UNKNOWN";
    const definitive = ["PAYMENT_PROVIDER_AUTHENTICATION_FAILED", "PAYMENT_PROVIDER_REQUEST_INVALID"].includes(code);
    await prisma.paystackSandboxVerification.updateMany({
      where: { id: record.id, status: "CREATED" },
      data: { status: definitive ? "FAILED" : "UNKNOWN", failureCode: code },
    });
    throw new PaymentError(
      definitive ? "PAYMENT_PROVIDER_NOT_CONFIGURED" : "PAYMENT_PROVIDER_UNAVAILABLE",
      "Unable to initialize isolated Paystack sandbox verification.",
      !definitive,
    );
  }
}

export async function settleSandboxGatewayVerification(
  reference: string,
  options?: { actorId?: string; clientOverride?: PaystackClient; env?: EnvRecord; refresh?: boolean },
): Promise<SandboxAcceptanceResult | null> {
  if (!/^pay_sbox_[a-f0-9]{24}$/.test(reference)) return null;
  const whereClause = options?.actorId ? { reference, actorUserId: options.actorId } : { reference };
  const record = await prisma.paystackSandboxVerification.findFirst({
    where: whereClause,
    include: { releaseProvenance: { select: { resultDigest: true } } },
  });
  if (!record) return null;
  if (!options?.refresh || record.status === "SUCCEEDED" || record.status === "FAILED") {
    return publicResult(record);
  }

  const config = resolveSandboxAcceptanceConfiguration(options?.env ?? process.env);
  if (!config.eligible || !config.secretKey) return publicResult(record);

  try {
    const paystack = options?.clientOverride ?? new PaystackClient({ secretKey: config.secretKey });
    const verified = await paystack.verifyTransaction(reference, AbortSignal.timeout(12_000));
    if (
      verified.reference !== reference ||
      verified.amount !== record.amountCents ||
      verified.currency !== "ZAR" ||
      verified.domain !== "test" ||
      (verified.customer?.email && verified.customer.email.toLowerCase() !== record.payerEmail.toLowerCase())
    ) {
      return publicResult(record);
    }

    if (["failed", "abandoned", "reversed"].includes(verified.status)) {
      await prisma.paystackSandboxVerification.updateMany({
        where: { id: record.id, status: { notIn: ["SUCCEEDED", "FAILED"] } },
        data: { status: "FAILED", verifiedAt: new Date(), failureCode: `PAYSTACK_SANDBOX_${verified.status.toUpperCase()}` },
      });
    } else if (verified.status === "success") {
      const confirmedAt = verified.paid_at ? new Date(verified.paid_at) : new Date();
      const amountDecimal = (record.amountCents / 100).toFixed(2);
      const providerRef = String(verified.id);

      await prisma.$transaction(
        async (tx) => {
          await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "PaystackSandboxVerification" WHERE "id" = ${record.id} FOR UPDATE`);
          const fresh = await tx.paystackSandboxVerification.findUniqueOrThrow({ where: { id: record.id } });
          if (fresh.status === "SUCCEEDED" && fresh.ledgerJournalId) return;

          const { cashClearing, fundsHeld } = await ensureIsolatedSandboxLedgerAccounts(tx);
          const journal = await postLedgerJournalWithinTransaction(
            tx,
            buildSandboxAcceptanceReceiptPosting({
              paymentReference: fresh.reference,
              attemptReference: fresh.attemptReference,
              providerReference: providerRef,
              releaseSha: fresh.releaseSha,
              amount: amountDecimal,
              cashClearingAccountId: cashClearing.id,
              fundsHeldAccountId: fundsHeld.id,
            }),
          );

          const resultDigest = computeSandboxProvenanceDigest({
            paymentReference: fresh.reference,
            attemptReference: fresh.attemptReference,
            ledgerJournalId: journal.id,
            provider: "PAYSTACK",
            providerEnvironment: "SANDBOX",
            subjectType: "SANDBOX_ACCEPTANCE",
            subjectNamespace: SANDBOX_PLATFORM_ACCOUNTS.walletOwnerId,
            amount: amountDecimal,
            currency: "ZAR",
            providerReference: providerRef,
            paymentCreatedAt: fresh.createdAt,
            providerConfirmedAt: confirmedAt,
            releaseSha: fresh.releaseSha,
            deploymentId: fresh.deploymentId,
          });

          await tx.paystackSandboxVerification.update({
            where: { id: fresh.id },
            data: {
              status: "SUCCEEDED",
              providerDomain: "test",
              providerReference: providerRef,
              providerTransactionId: providerRef,
              ledgerJournalId: journal.id,
              verifiedAt: confirmedAt,
              failureCode: null,
            },
          });

          await tx.paymentReleaseProvenance.create({
            data: {
              paymentReference: fresh.reference,
              attemptId: fresh.attemptReference,
              sandboxVerificationId: fresh.id,
              ledgerJournalId: journal.id,
              provider: "PAYSTACK",
              providerEnvironment: "SANDBOX",
              subjectType: "SANDBOX_ACCEPTANCE",
              subjectNamespace: SANDBOX_PLATFORM_ACCOUNTS.walletOwnerId,
              providerReference: providerRef,
              amount: new Prisma.Decimal(amountDecimal),
              currency: "ZAR",
              releaseSha: fresh.releaseSha,
              deploymentId: fresh.deploymentId,
              paymentCreatedAt: fresh.createdAt,
              providerConfirmedAt: confirmedAt,
              resultDigest,
            },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    }
  } catch (error) {
    console.warn("PAYSTACK_SANDBOX_ACCEPTANCE_VERIFY_INCONCLUSIVE", {
      code: error instanceof PaymentError ? error.code : "PROVIDER_LOOKUP_UNKNOWN",
      reference,
    });
  }

  return publicResult(
    await prisma.paystackSandboxVerification.findUniqueOrThrow({
      where: { id: record.id },
      include: { releaseProvenance: { select: { resultDigest: true } } },
    }),
  );
}

export async function processSandboxAcceptanceWebhook(
  rawBody: Uint8Array,
  headers: { legacyHmac?: string | null; webhookV1?: string | null },
  options?: { clientOverride?: PaystackClient; env?: EnvRecord },
): Promise<{ accepted: boolean; status: string; reference: string | null }> {
  const config = resolveSandboxAcceptanceConfiguration(options?.env ?? process.env);
  if (!config.eligible || !config.secretKey) {
    return { accepted: false, status: "LANE_UNAVAILABLE", reference: null };
  }

  const validV1 = config.webhookSecrets.length > 0 && verifyPaystackWebhookSecretSignature(rawBody, headers.webhookV1, config.webhookSecrets);
  const validHmac = verifyPaystackSignature(rawBody, headers.legacyHmac, config.secretKey);
  if (!validV1 && !validHmac) {
    return { accepted: false, status: "INVALID_SIGNATURE", reference: null };
  }

  let parsed: { event?: unknown; data?: { reference?: unknown; domain?: unknown } };
  try {
    parsed = JSON.parse(Buffer.from(rawBody).toString("utf8"));
  } catch {
    return { accepted: false, status: "INVALID_PAYLOAD", reference: null };
  }

  const reference = typeof parsed?.data?.reference === "string" ? parsed.data.reference.trim() : null;
  if (!reference || !/^pay_sbox_[a-f0-9]{24}$/.test(reference)) {
    return { accepted: true, status: "IGNORED_NON_SANDBOX_ACCEPTANCE_REF", reference: null };
  }

  const settled = await settleSandboxGatewayVerification(reference, {
    refresh: true,
    clientOverride: options?.clientOverride,
    env: options?.env,
  });
  return {
    accepted: Boolean(settled),
    status: settled?.status ?? "UNKNOWN_REFERENCE",
    reference,
  };
}
