import {
  evaluatePaystackCheckoutReadiness,
  isPaystackEftChannelApproved,
  PAYSTACK_API_BASE_URL,
  type PaystackRuntimeConfiguration,
} from "@/lib/payments/providers/paystack/paystack-config";
import { PAYSTACK_CAPABILITIES, PaystackAdapter } from "@/lib/payments/providers/paystack/paystack-adapter";
import type { PaymentProviderReadinessDto } from "@/lib/payments/providers/payment-provider-registry";
import { PaystackClient } from "@/lib/payments/providers/paystack/paystack-client";
import { PaymentError } from "@/lib/payments/errors";

type EnvironmentSource = Readonly<Record<string, string | undefined>>;

export const QA_ACCEPTANCE_PLATFORM_OWNER_ID = "platform-sandbox-acceptance" as const;

export const QA_ACCEPTANCE_PLATFORM_ACCOUNTS = Object.freeze({
  walletOwnerId: QA_ACCEPTANCE_PLATFORM_OWNER_ID,
  cashClearingCode: "PLATFORM-SANDBOX-ACCEPTANCE-CASH-CLEARING-ZAR",
  fundsHeldCode: "PLATFORM-SANDBOX-ACCEPTANCE-FUNDS-HELD-ZAR",
  commissionRevenueCode: "PLATFORM-SANDBOX-ACCEPTANCE-COMMISSION-REVENUE-ZAR",
  adjustmentCode: "PLATFORM-SANDBOX-ACCEPTANCE-ADJUSTMENT-ZAR",
  codShortageSuspenseCode: "PLATFORM-SANDBOX-ACCEPTANCE-CASH-SHORT-OVER-SUSPENSE-ZAR",
} as const);

const QA_SANDBOX_ACCOUNT_CODES = new Set<string>([
  QA_ACCEPTANCE_PLATFORM_ACCOUNTS.cashClearingCode,
  QA_ACCEPTANCE_PLATFORM_ACCOUNTS.fundsHeldCode,
  QA_ACCEPTANCE_PLATFORM_ACCOUNTS.commissionRevenueCode,
  QA_ACCEPTANCE_PLATFORM_ACCOUNTS.adjustmentCode,
  QA_ACCEPTANCE_PLATFORM_ACCOUNTS.codShortageSuspenseCode,
]);

export function isQaSandboxPlatformAccountCode(code: string | null | undefined): boolean {
  if (typeof code !== "string") return false;
  return QA_SANDBOX_ACCOUNT_CODES.has(code.trim().toUpperCase());
}

export type QaAcceptanceLaneConfig = Readonly<{
  eligible: boolean;
  laneFlagEnabled: boolean;
  acceptanceSandboxFlagEnabled: boolean;
  secretSource: "PAYSTACK_ACCEPTANCE_SANDBOX_SECRET_KEY" | "PAYSTACK_TEMPORARY_SANDBOX_SECRET_KEY" | "NONE";
  secretConfigured: boolean;
  publicKeyConfigured: boolean;
  publicKey: string | null;
  reason: string;
  credentialVersion: string;
  releaseSha: string | null;
}>;

function hasUsableSecret(value: string | undefined): boolean {
  if (!value) return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  return !/(?:replace-with|placeholder|change[-_ ]?me|example\.invalid|your[-_ ]?(?:key|secret|token))/i.test(trimmed);
}

function resolveAppOriginForQa(source: EnvironmentSource): string {
  const candidates = [source.NEXT_PUBLIC_APP_URL, source.APP_URL, source.NEXTAUTH_URL];
  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      const parsed = new URL(candidate);
      if (parsed.protocol === "https:" || parsed.protocol === "http:") {
        return `${parsed.protocol}//${parsed.host}`;
      }
    } catch {
      continue;
    }
  }
  return "http://127.0.0.1:3000";
}

function resolveQaSecretAndSource(source: EnvironmentSource): Readonly<{
  secretKey: string | null;
  secretSource: QaAcceptanceLaneConfig["secretSource"];
  webhookSecretKey: string | null;
  publicKey: string | null;
  errorReason: string | null;
}> {
  if (source.PAYSTACK_TEMPORARY_SANDBOX_ENABLED?.trim().toLowerCase() === "true") {
    return Object.freeze({
      secretKey: null,
      secretSource: "NONE",
      webhookSecretKey: null,
      publicKey: null,
      errorReason: "Temporary checkout sandbox is active; deactivate PAYSTACK_TEMPORARY_SANDBOX_ENABLED first.",
    });
  }

  const liveKey = (source.PAYSTACK_SECRET_KEY ?? "").trim();
  const explicitKey = (source.PAYSTACK_ACCEPTANCE_SANDBOX_SECRET_KEY ?? "").trim();
  const tempKey = (source.PAYSTACK_TEMPORARY_SANDBOX_SECRET_KEY ?? "").trim();

  let secretKey: string | null = null;
  let secretSource: QaAcceptanceLaneConfig["secretSource"] = "NONE";
  if (hasUsableSecret(explicitKey)) {
    secretKey = explicitKey;
    secretSource = "PAYSTACK_ACCEPTANCE_SANDBOX_SECRET_KEY";
  } else if (hasUsableSecret(tempKey)) {
    secretKey = tempKey;
    secretSource = "PAYSTACK_TEMPORARY_SANDBOX_SECRET_KEY";
  }

  if (!secretKey) {
    return Object.freeze({
      secretKey: null,
      secretSource: "NONE",
      webhookSecretKey: null,
      publicKey: null,
      errorReason: "Paystack test secret key (PAYSTACK_ACCEPTANCE_SANDBOX_SECRET_KEY or PAYSTACK_TEMPORARY_SANDBOX_SECRET_KEY) is missing.",
    });
  }

  if (!secretKey.startsWith("sk_test_")) {
    return Object.freeze({
      secretKey: null,
      secretSource: "NONE",
      webhookSecretKey: null,
      publicKey: null,
      errorReason: "QA acceptance Paystack key must be a Paystack test secret key (sk_test_).",
    });
  }

  if (liveKey && secretKey === liveKey) {
    return Object.freeze({
      secretKey: null,
      secretSource: "NONE",
      webhookSecretKey: null,
      publicKey: null,
      errorReason: "QA acceptance Paystack secret key must remain distinct from PAYSTACK_SECRET_KEY.",
    });
  }

  const explicitPublic = (source.PAYSTACK_ACCEPTANCE_SANDBOX_PUBLIC_KEY ?? "").trim();
  const tempPublic = (source.PAYSTACK_TEMPORARY_SANDBOX_PUBLIC_KEY ?? "").trim();
  const publicKeyCandidate = explicitPublic.startsWith("pk_test_")
    ? explicitPublic
    : tempPublic.startsWith("pk_test_")
      ? tempPublic
      : null;

  const explicitWebhook = (source.PAYSTACK_ACCEPTANCE_SANDBOX_WEBHOOK_SECRET ?? "").trim();
  const tempWebhook = (source.PAYSTACK_TEMPORARY_SANDBOX_WEBHOOK_SECRET ?? "").trim();
  const webhookSecretKey = hasUsableSecret(explicitWebhook)
    ? explicitWebhook
    : hasUsableSecret(tempWebhook)
      ? tempWebhook
      : secretKey;

  return Object.freeze({
    secretKey,
    secretSource,
    webhookSecretKey,
    publicKey: publicKeyCandidate,
    errorReason: null,
  });
}

/**
 * Resolves the strictly fail-closed QA Acceptance Lane configuration.
 * Never returns live Paystack credentials and never activates unless explicitly enabled.
 */
export function resolveQaAcceptanceLaneConfig(
  source: EnvironmentSource = process.env,
): QaAcceptanceLaneConfig {
  const laneFlagEnabled = source.QA_ACCEPTANCE_LANE_ENABLED?.trim().toLowerCase() === "true";
  const acceptanceSandboxFlagEnabled =
    source.PAYSTACK_ACCEPTANCE_SANDBOX_ENABLED?.trim().toLowerCase() === "true";
  const releaseSha = (
    source.RAILWAY_GIT_COMMIT_SHA ??
    source.VERCEL_GIT_COMMIT_SHA ??
    source.GITHUB_SHA ??
    ""
  ).trim() || null;
  const credentialVersion =
    (source.PAYSTACK_ACCEPTANCE_SANDBOX_CREDENTIAL_VERSION ??
      source.PAYSTACK_TEMPORARY_SANDBOX_CREDENTIAL_VERSION ??
      "paystack-qa-sandbox-v1").trim() || "paystack-qa-sandbox-v1";

  if (!laneFlagEnabled && !acceptanceSandboxFlagEnabled) {
    return Object.freeze({
      eligible: false,
      laneFlagEnabled,
      acceptanceSandboxFlagEnabled,
      secretSource: "NONE",
      secretConfigured: false,
      publicKeyConfigured: false,
      publicKey: null,
      reason: "QA acceptance lane is disabled (set QA_ACCEPTANCE_LANE_ENABLED=true or PAYSTACK_ACCEPTANCE_SANDBOX_ENABLED=true).",
      credentialVersion,
      releaseSha,
    });
  }

  const secretResolution = resolveQaSecretAndSource(source);
  if (secretResolution.errorReason || !secretResolution.secretKey) {
    return Object.freeze({
      eligible: false,
      laneFlagEnabled,
      acceptanceSandboxFlagEnabled,
      secretSource: "NONE",
      secretConfigured: false,
      publicKeyConfigured: Boolean(secretResolution.publicKey),
      publicKey: secretResolution.publicKey,
      reason: secretResolution.errorReason ?? "Paystack QA test key is not configured.",
      credentialVersion,
      releaseSha,
    });
  }

  return Object.freeze({
    eligible: true,
    laneFlagEnabled,
    acceptanceSandboxFlagEnabled,
    secretSource: secretResolution.secretSource,
    secretConfigured: true,
    publicKeyConfigured: Boolean(secretResolution.publicKey),
    publicKey: secretResolution.publicKey,
    reason: "QA acceptance lane is ready with Paystack test-mode credentials.",
    credentialVersion,
    releaseSha,
  });
}

export function resolveQaPaystackRuntimeConfig(
  source: EnvironmentSource = process.env,
): PaystackRuntimeConfiguration {
  const summary = resolveQaAcceptanceLaneConfig(source);
  const resolved = resolveQaSecretAndSource(source);
  if (!summary.eligible || !resolved.secretKey) {
    throw new PaymentError(
      "PAYMENT_PROVIDER_NOT_CONFIGURED",
      summary.reason,
    );
  }
  return Object.freeze({
    mode: "test",
    environment: "sandbox",
    secretKey: resolved.secretKey,
    appOrigin: resolveAppOriginForQa(source),
    apiBaseUrl: PAYSTACK_API_BASE_URL,
    credentialVersion: summary.credentialVersion,
    checkoutAuditVersion: "paystack-redirect-v1",
    configurationFingerprint: "paystack-v1:sandbox",
    eftChannelEnabled: source.PAYSTACK_EFT_CHANNEL_ENABLED?.trim().toLowerCase() === "true",
  });
}

export function resolveQaPaystackWebhookSecrets(
  source: EnvironmentSource = process.env,
): readonly string[] {
  const summary = resolveQaAcceptanceLaneConfig(source);
  if (!summary.eligible) return [];
  const resolved = resolveQaSecretAndSource(source);
  const secrets = new Set<string>();
  if (resolved.webhookSecretKey) secrets.add(resolved.webhookSecretKey);
  if (resolved.secretKey) secrets.add(resolved.secretKey);
  return Object.freeze([...secrets]);
}

export function createQaPaystackClient(source: EnvironmentSource = process.env): PaystackClient {
  const runtime = resolveQaPaystackRuntimeConfig(source);
  return new PaystackClient({
    secretKey: runtime.secretKey,
    baseUrl: runtime.apiBaseUrl,
  });
}

export function createQaPaystackAdapter(source: EnvironmentSource = process.env): PaystackAdapter {
  const runtime = resolveQaPaystackRuntimeConfig(source);
  return new PaystackAdapter(runtime);
}

export function buildQaSandboxProviderReadiness(
  source: EnvironmentSource = process.env,
): readonly PaymentProviderReadinessDto[] {
  const summary = resolveQaAcceptanceLaneConfig(source);
  const eftApproved = isPaystackEftChannelApproved(source);
  const providerState = {
    code: "PAYSTACK" as const,
    configured: summary.secretConfigured,
    active: summary.eligible,
    environment: summary.eligible ? ("sandbox" as const) : ("not-configured" as const),
    errorCategory: (summary.eligible ? "NONE" : "CONFIGURATION") as "NONE" | "CONFIGURATION",
    blockReason: summary.eligible ? null : ("CONFIGURATION_INVALID" as const),
    credentialVersionConfigured: summary.secretConfigured,
    sourceAddressTrustConfigured: true,
    itnVerificationImplemented: true,
    productionValidationApproved: false,
  };
  const checkoutReadiness = evaluatePaystackCheckoutReadiness(providerState, {
    adapterPresent: summary.eligible,
    requireAdapterPresent: true,
  });
  const eftReadiness = evaluatePaystackCheckoutReadiness(providerState, {
    adapterPresent: summary.eligible,
    requiredChannel: "eft",
    eftChannelApproved: eftApproved,
  });
  return Object.freeze([
    Object.freeze({
      ...providerState,
      checkoutReadiness,
      eftReadiness,
      capabilities: PAYSTACK_CAPABILITIES,
    }),
  ]);
}
