import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/db/prisma";
import { PaymentError } from "@/lib/payments/errors";
import { PaystackClient, validatePaystackAuthorizationUrl } from "@/lib/payments/providers/paystack/paystack-client";
import { classifyRuntimeEnvironment } from "@/lib/runtime/deployment-classification";

export const LIVE_GATEWAY_VERIFICATION_CENTS = 100 as const;
const RECENT_WINDOW_MS = 24 * 60 * 60 * 1000;
const MAX_VERIFICATIONS_PER_WINDOW = 2;
const ACTIVE_STATUSES = ["CREATED", "CHECKOUT_READY", "UNKNOWN"];

type LiveVerificationEnvironment = Record<string, string | undefined>;
type Actor = Readonly<{ id: string; email: string }>;

export type LiveVerificationResult = Readonly<{
  reference: string;
  status: string;
  amount: "1.00";
  currency: "ZAR";
  checkoutUrl: string | null;
  verifiedAt: string | null;
  failureCode: string | null;
}>;

/**
 * A SUPER_ADMIN-initiated, fixed-value, isolated gateway connectivity check.
 * Deliberately independent of CHECKOUT_PUBLIC_ENABLED: this does NOT turn on
 * general checkout, courier fulfilment, transfers or commercial release.
 */
export function resolveLiveGatewayVerificationConfiguration(
  source: LiveVerificationEnvironment = process.env,
): Readonly<{ eligible: boolean; reason: string; secretKey: string | null; origin: string | null }> {
  const runtime = classifyRuntimeEnvironment(source);
  // A real-money diagnostic must never run with a merely inferred or
  // contradictory database classification.
  if (source.KT_DATABASE_CLASSIFICATION?.trim().toLowerCase() !== "production" ||
      !runtime.isValid || runtime.runtime !== "production" || source.NODE_ENV !== "production") {
    return { eligible: false, reason: "PRODUCTION_RUNTIME_REQUIRED", secretKey: null, origin: null };
  }
  // The real-money diagnostic must never route through disposable Paystack.
  if (source.KT_E2E_PAYSTACK_ACCEPTANCE === "true") {
    return { eligible: false, reason: "DISPOSABLE_PROVIDER_NOT_ALLOWED", secretKey: null, origin: null };
  }
  if (source.PAYSTACK_TEMPORARY_SANDBOX_ENABLED === "true") {
    return { eligible: false, reason: "SANDBOX_OVERRIDE_MUST_BE_DISABLED", secretKey: null, origin: null };
  }
  if (source.PAYSTACK_MODE?.trim().toLowerCase() !== "live") {
    return { eligible: false, reason: "PAYSTACK_LIVE_MODE_REQUIRED", secretKey: null, origin: null };
  }
  const secretKey = source.PAYSTACK_SECRET_KEY?.trim() ?? "";
  if (!/^sk_live_[A-Za-z0-9_]+$/.test(secretKey)) {
    return { eligible: false, reason: "VALID_LIVE_KEY_REQUIRED", secretKey: null, origin: null };
  }
  let origin: string | null = null;
  try {
    const url = new URL(source.PAYMENT_APP_ORIGIN ?? "");
    if (url.protocol === "https:" && ["ktcouriers.com", "www.ktcouriers.com"].includes(url.hostname) &&
      !url.username && !url.password && !url.port && !url.search && !url.hash &&
      (url.pathname === "/" || !url.pathname)) origin = url.origin;
  } catch {
    // Invalid callback configuration is not an excuse to send a real charge.
  }
  if (!origin) return { eligible: false, reason: "PRODUCTION_CALLBACK_ORIGIN_REQUIRED", secretKey: null, origin: null };
  return { eligible: true, reason: "READY", secretKey, origin };
}

function publicResult(value: {
  reference: string; status: string; checkoutUrl: string | null;
  verifiedAt: Date | null; failureCode: string | null;
}): LiveVerificationResult {
  return Object.freeze({
    reference: value.reference,
    status: value.status,
    amount: "1.00",
    currency: "ZAR",
    checkoutUrl: value.status === "CHECKOUT_READY" && value.checkoutUrl
      ? validatePaystackAuthorizationUrl(value.checkoutUrl) : null,
    verifiedAt: value.verifiedAt?.toISOString() ?? null,
    failureCode: value.failureCode,
  });
}

export async function createLiveGatewayVerification(actor: Actor, idempotencyKey: string): Promise<LiveVerificationResult> {
  const config = resolveLiveGatewayVerificationConfiguration();
  if (!config.eligible || !config.secretKey || !config.origin) {
    throw new PaymentError("PAYMENT_PROVIDER_NOT_CONFIGURED", config.reason);
  }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(idempotencyKey)) {
    throw new PaymentError("PAYMENT_METADATA_INVALID", "Invalid request identifier.");
  }
  if (!actor.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(actor.email)) {
    throw new PaymentError("PAYMENT_PAYER_EMAIL_REQUIRED", "A verified account email is required.");
  }

  const existing = await prisma.paystackLiveVerification.findUnique({ where: { idempotencyKey } });
  if (existing) {
    if (existing.actorUserId !== actor.id) throw new PaymentError("PAYMENT_PAYER_NOT_AUTHORIZED", "Verification belongs to another account.");
    return publicResult(existing);
  }

  const recent = await prisma.paystackLiveVerification.findMany({
    where: { actorUserId: actor.id, createdAt: { gte: new Date(Date.now() - RECENT_WINDOW_MS) } },
    orderBy: { createdAt: "desc" }, take: MAX_VERIFICATIONS_PER_WINDOW + 1,
  });
  const unresolved = recent.find(row => ACTIVE_STATUSES.includes(row.status));
  if (unresolved) return publicResult(unresolved);
  if (recent.length >= MAX_VERIFICATIONS_PER_WINDOW) {
    throw new PaymentError("PAYMENT_PROVIDER_RATE_LIMITED", "Live verification charge limit reached.");
  }

  const reference = "ktverify_" + randomBytes(16).toString("hex");
  let record;
  try {
    record = await prisma.paystackLiveVerification.create({
      data: { reference, idempotencyKey, actorUserId: actor.id, payerEmail: actor.email.trim().toLowerCase(),
        amountCents: LIVE_GATEWAY_VERIFICATION_CENTS, status: "CREATED" },
    });
  } catch (error) {
    // Unique operation keys are authoritative on concurrent browser submissions.
    if ((error as { code?: string }).code !== "P2002") throw error;
    const raced = await prisma.paystackLiveVerification.findUnique({ where: { idempotencyKey } });
    if (!raced || raced.actorUserId !== actor.id) throw new PaymentError("PAYMENT_IDEMPOTENCY_CONFLICT", "Verification was already started.");
    return publicResult(raced);
  }

  // The reference has never been submitted before this call; a verify-before-
  // initialize request would only add an avoidable missing-reference failure.
  const paystack = new PaystackClient({ secretKey: config.secretKey });
  try {
    const result = await paystack.initializeTransaction({
      email: record.payerEmail,
      amountCents: LIVE_GATEWAY_VERIFICATION_CENTS,
      reference: record.reference,
      callbackUrl: config.origin + "/admin/payment-providers/live-verification?reference=" + encodeURIComponent(record.reference),
      metadata: { ktPurpose: "LIVE_GATEWAY_VERIFICATION", verificationReference: record.reference },
    }, AbortSignal.timeout(12_000));
    if (result.reference !== record.reference) {
      throw new PaymentError("PAYMENT_PROVIDER_REFERENCE_CONFLICT", "Paystack returned a mismatched verification reference.");
    }
    const url = validatePaystackAuthorizationUrl(result.authorization_url);
    await prisma.paystackLiveVerification.updateMany({
      where: { id: record.id, status: "CREATED" },
      data: { status: "CHECKOUT_READY", checkoutUrl: url },
    });
    const updated = await prisma.paystackLiveVerification.findUniqueOrThrow({ where: { id: record.id } });
    return publicResult(updated);
  } catch (error) {
    const code = error instanceof PaymentError ? error.code : "PAYSTACK_INITIALIZE_OUTCOME_UNKNOWN";
    // Only provider-authentication/explicit-invalid-request responses are
    // definitive failures; timeouts and malformed replies remain UNKNOWN.
    const definitive = ["PAYMENT_PROVIDER_AUTHENTICATION_FAILED", "PAYMENT_PROVIDER_REQUEST_INVALID"].includes(code);
    await prisma.paystackLiveVerification.updateMany({
      where: { id: record.id, status: "CREATED" },
      data: { status: definitive ? "FAILED" : "UNKNOWN", failureCode: code },
    });
    console.warn("LIVE_GATEWAY_VERIFICATION_INIT_FAILED", { code, reference: record.reference });
    throw new PaymentError(definitive ? "PAYMENT_PROVIDER_NOT_CONFIGURED" : "PAYMENT_PROVIDER_UNAVAILABLE",
      "Unable to initialize a confirmed live payment verification.", !definitive);
  }
}

export async function getLiveGatewayVerification(actorId: string, reference: string, refresh = false): Promise<LiveVerificationResult | null> {
  if (!/^ktverify_[a-f0-9]{32}$/.test(reference)) return null;
  const record = await prisma.paystackLiveVerification.findFirst({ where: { reference, actorUserId: actorId } });
  if (!record) return null;
  if (!refresh || record.status === "SUCCEEDED" || record.status === "FAILED") return publicResult(record);

  const config = resolveLiveGatewayVerificationConfiguration();
  if (!config.eligible || !config.secretKey) return publicResult(record);
  try {
    const result = await new PaystackClient({ secretKey: config.secretKey }).verifyTransaction(reference, AbortSignal.timeout(12_000));
    if (result.reference !== reference || result.amount !== LIVE_GATEWAY_VERIFICATION_CENTS ||
      result.currency !== "ZAR" || result.domain !== "live" ||
      (result.customer?.email && result.customer.email.toLowerCase() !== record.payerEmail.toLowerCase())) {
      console.warn("LIVE_GATEWAY_VERIFICATION_BINDING_MISMATCH", { reference });
      return publicResult(record);
    }
    const terminalStatus = result.status === "success" ? "SUCCEEDED"
      : ["failed", "abandoned", "reversed"].includes(result.status) ? "FAILED" : null;
    if (terminalStatus) {
      await prisma.paystackLiveVerification.updateMany({
        where: { id: record.id, status: { notIn: ["SUCCEEDED", "FAILED"] } },
        data: {
          status: terminalStatus,
          verifiedAt: new Date(),
          providerTransactionId: String(result.id),
          failureCode: terminalStatus === "FAILED" ? "PROVIDER_VERIFIED_FAILED" : null,
        },
      });
    }
  } catch (error) {
    console.warn("LIVE_GATEWAY_VERIFICATION_CHECK_INCONCLUSIVE", {
      code: error instanceof PaymentError ? error.code : "PROVIDER_LOOKUP_UNKNOWN", reference,
    });
  }
  return publicResult(await prisma.paystackLiveVerification.findUniqueOrThrow({ where: { id: record.id } }));
}
