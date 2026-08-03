import { prisma } from "@/lib/db/prisma";
import { PaymentError, type PaymentErrorCode } from "@/lib/payments/errors";
import type { PaymentReconciliationReasonCode, PaymentWebhookNormalizedStatusCode } from "@/lib/payments/types";
import { resolvePayfastConfiguration, type PayfastConfigurationResolution } from "@/lib/payments/providers/payfast/payfast-config";
import { verifyPayfastItnAmount } from "@/lib/payments/providers/payfast/payfast-itn-amount";
import { validatePayfastItnFields, type ValidatedPayfastItnFields } from "@/lib/payments/providers/payfast/payfast-itn-fields";
import { parsePayfastItnForm } from "@/lib/payments/providers/payfast/payfast-itn-parser";
import { buildPayfastItnParameterString } from "@/lib/payments/providers/payfast/payfast-itn-parameter-string";
import { verifyPayfastItnSignature } from "@/lib/payments/providers/payfast/payfast-itn-signature";
import { normalizePayfastItnStatus } from "@/lib/payments/providers/payfast/payfast-itn-status-policy";
import { confirmPayfastItnData } from "@/lib/payments/providers/payfast/payfast-itn-validation-client";
import { fingerprintPayfastWebhook } from "@/lib/payments/providers/payfast/payfast-webhook-fingerprint";
import { resolvePaymentProxyMode, resolvePayfastSourceAddress } from "@/lib/payments/providers/payfast/payfast-source-address";
import { payfastSourceIpResolver, type PayfastSourceIpResolver } from "@/lib/payments/providers/payfast/payfast-source-ip-resolver";
import { assertPayfastSourceRateLimit } from "@/lib/payments/providers/payfast/payfast-itn-rate-limit";
import { isTerminalPayfastEventState } from "@/lib/payments/providers/payfast/payfast-event-policy";
import { assertPayfastItnAttemptConfiguration, resolvePayfastItnAttempt, type ResolvedPayfastItnAttempt } from "./payfast-itn-resolution.service";

export type PayfastReceiptDraft = Readonly<{
  fingerprint: string;
  environment: "SANDBOX" | "PRODUCTION";
  merchantReference: string;
  providerPaymentId: string;
  providerStatus: string;
  normalizedStatus: PaymentWebhookNormalizedStatusCode;
  sourceAddress: string;
  credentialVersion: string | null;
  paymentId: string | null;
  attemptId: string | null;
  safePayloadSnapshot: ValidatedPayfastItnFields["safePayloadSnapshot"];
  unknownFieldCount: number;
  sourceAddressVerified: boolean;
  signatureVerified: boolean;
  merchantVerified: boolean;
  amountVerified: boolean;
  providerDataVerified: boolean;
}>;

export class PayfastItnVerificationFailure extends PaymentError {
  constructor(
    code: PaymentErrorCode,
    message: string,
    retryable: boolean,
    public readonly receipt: PayfastReceiptDraft | null,
    public readonly reconciliationReason: PaymentReconciliationReasonCode | null,
    cause?: unknown,
  ) {
    super(code, message, retryable, cause === undefined ? undefined : { cause });
    this.name = "PayfastItnVerificationFailure";
  }
}

export type VerifiedPayfastItn = Readonly<{
  kind: "VERIFIED";
  receipt: PayfastReceiptDraft;
  fields: ValidatedPayfastItnFields;
  attempt: ResolvedPayfastItnAttempt;
  verifiedAt: Date;
}>;

export type ExistingPayfastItn = Readonly<{
  kind: "EXISTING";
  eventId: string;
  processingStatus: string;
}>;

type Dependencies = Readonly<{
  configuration?: () => PayfastConfigurationResolution;
  sourceResolver?: Pick<PayfastSourceIpResolver, "verify">;
  resolveAttempt?: typeof resolvePayfastItnAttempt;
  confirm?: typeof confirmPayfastItnData;
  findReceipt?: (fingerprint: string) => Promise<{ id: string; processingStatus: string } | null>;
  clock?: () => Date;
  peerAddress?: string | null;
  proxyMode?: "direct" | "single_trusted_proxy";
}>;

function reasonFor(code: PaymentErrorCode): PaymentReconciliationReasonCode | null {
  if (code === "PAYFAST_CREDENTIAL_VERSION_MISMATCH") return "CREDENTIAL_VERSION_MISMATCH";
  if (code === "PAYFAST_MERCHANT_MISMATCH") return "MERCHANT_MISMATCH";
  if (code === "PAYFAST_AMOUNT_MISMATCH") return "AMOUNT_MISMATCH";
  if (code === "PAYFAST_CONFIRMATION_UNAVAILABLE") return "PROVIDER_CONFIRMATION_UNAVAILABLE";
  return null;
}

export async function verifyPayfastItn(input: {
  bodyBytes: Uint8Array;
  bodyText: string;
  headers: Headers;
}, dependencies: Dependencies = {}): Promise<VerifiedPayfastItn | ExistingPayfastItn> {
  const parsed = parsePayfastItnForm(input.bodyText);
  const fields = validatePayfastItnFields(parsed);
  const resolution = (dependencies.configuration ?? resolvePayfastConfiguration)();
  if (!resolution.runtime) throw new PaymentError("PAYFAST_CONFIGURATION_INVALID", "Payfast ITN verification is not configured.", true);
  const runtime = resolution.runtime;
  const environment = runtime.environment === "sandbox" ? "SANDBOX" as const : "PRODUCTION" as const;
  const sourceAddress = resolvePayfastSourceAddress({
    mode: dependencies.proxyMode ?? resolvePaymentProxyMode(process.env.PAYMENT_PROXY_MODE),
    headers: input.headers,
    peerAddress: dependencies.peerAddress,
  });
  await (dependencies.sourceResolver ?? payfastSourceIpResolver).verify(environment, sourceAddress);
  assertPayfastSourceRateLimit(sourceAddress);
  const fingerprint = fingerprintPayfastWebhook(environment, input.bodyBytes);
  const findReceipt = dependencies.findReceipt ?? (async (identity: string) => {
    return prisma.paymentWebhookEvent.findUnique({ where: { eventFingerprint: identity }, select: { id: true, processingStatus: true } });
  });
  const existing = await findReceipt(fingerprint);
  if (existing && isTerminalPayfastEventState(existing.processingStatus)) {
    return Object.freeze({ kind: "EXISTING", eventId: existing.id, processingStatus: existing.processingStatus });
  }

  const normalizedStatus = normalizePayfastItnStatus(fields.providerStatus);
  let attempt: ResolvedPayfastItnAttempt | null = null;
  const draft = (overrides: Partial<PayfastReceiptDraft> = {}): PayfastReceiptDraft => Object.freeze({
    fingerprint,
    environment,
    merchantReference: fields.merchantReference,
    providerPaymentId: fields.providerPaymentId,
    providerStatus: fields.providerStatus,
    normalizedStatus,
    sourceAddress,
    credentialVersion: attempt?.providerCredentialVersion ?? runtime.credentialVersion,
    paymentId: attempt?.paymentId ?? null,
    attemptId: attempt?.id ?? null,
    safePayloadSnapshot: fields.safePayloadSnapshot,
    unknownFieldCount: fields.unknownFieldCount,
    sourceAddressVerified: true,
    signatureVerified: false,
    merchantVerified: false,
    amountVerified: false,
    providerDataVerified: false,
    ...overrides,
  });

  try {
    attempt = await (dependencies.resolveAttempt ?? resolvePayfastItnAttempt)(fields.merchantReference);
    assertPayfastItnAttemptConfiguration(attempt, runtime);
    if (!verifyPayfastItnSignature(parsed.orderedFields, fields.signature, runtime.passphrase)) {
      throw new PaymentError("PAYFAST_ITN_SIGNATURE_INVALID", "Payfast ITN signature is invalid.");
    }
    if (fields.merchantId !== runtime.merchantId) {
      throw new PaymentError("PAYFAST_MERCHANT_MISMATCH", "Payfast Merchant ID does not match the configured merchant.");
    }
    verifyPayfastItnAmount(fields.amountGross, attempt.payment.amount, attempt.payment.currency);
    await (dependencies.confirm ?? confirmPayfastItnData)({
      environment,
      canonicalBody: buildPayfastItnParameterString(parsed.orderedFields, { includePassphrase: false }),
    });
    return Object.freeze({
      kind: "VERIFIED",
      receipt: draft({ signatureVerified: true, merchantVerified: true, amountVerified: true, providerDataVerified: true }),
      fields,
      attempt,
      verifiedAt: (dependencies.clock ?? (() => new Date()))(),
    });
  } catch (error) {
    if (!(error instanceof PaymentError)) throw error;
    const signatureVerified = Boolean(attempt) && !["PAYFAST_CREDENTIAL_VERSION_MISMATCH", "PAYFAST_ITN_SIGNATURE_INVALID", "PAYFAST_CONFIGURATION_INVALID"].includes(error.code);
    const merchantVerified = signatureVerified && error.code !== "PAYFAST_MERCHANT_MISMATCH";
    const amountVerified = merchantVerified && error.code !== "PAYFAST_AMOUNT_MISMATCH";
    throw new PayfastItnVerificationFailure(
      error.code,
      error.message,
      error.retryable,
      draft({ signatureVerified, merchantVerified, amountVerified }),
      reasonFor(error.code),
      error,
    );
  }
}
