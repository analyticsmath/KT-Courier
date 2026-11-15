import { PaymentError } from "../../errors";
import type { SafeProviderConfigurationState } from "../provider-config";
import { classifyRuntimeEnvironment } from "@/lib/runtime/deployment-classification";

export const PAYSTACK_PROVIDER_IDENTITY = "South African Paystack Gateway" as const;
export const PAYSTACK_API_BASE_URL = "https://api.paystack.co" as const;

export type PaystackMode = "disabled" | "test" | "live";
export type PaystackEnvironment = "sandbox" | "production";

export type PaystackRuntimeConfiguration = Readonly<{
  mode: PaystackMode;
  environment: PaystackEnvironment;
  secretKey: string;
  appOrigin: string;
  apiBaseUrl: string;
  credentialVersion: string;
  checkoutAuditVersion: "paystack-redirect-v1";
  configurationFingerprint: "paystack-v1:sandbox" | "paystack-v1:production";
  eftChannelEnabled: boolean;
}>;

export function isPaystackEftChannelApproved(
  source: EnvironmentSource = process.env,
): boolean {
  return source.PAYSTACK_EFT_CHANNEL_ENABLED?.trim().toLowerCase() === "true";
}

export type PaystackConfigurationResolution = Readonly<{
  state: SafeProviderConfigurationState;
  runtime: PaystackRuntimeConfiguration | null;
}>;

type EnvironmentSource = Readonly<Record<string, string | undefined>>;

function state(args: Omit<SafeProviderConfigurationState, "code">): SafeProviderConfigurationState {
  return Object.freeze({ code: "PAYSTACK", ...args });
}

function invalidState(
  environment: "sandbox" | "production" | "not-configured" = "not-configured",
  blockReason: SafeProviderConfigurationState["blockReason"] = "CONFIGURATION_INVALID",
): SafeProviderConfigurationState {
  return state({
    configured: false,
    active: false,
    credentialVersionConfigured: false,
    sourceAddressTrustConfigured: true,
    itnVerificationImplemented: true,
    productionValidationApproved: false,
    environment,
    errorCategory: "CONFIGURATION",
    blockReason,
  });
}

function hasUsableValue(value: string | undefined): boolean {
  if (!value) return false;
  const trimmed = value.trim();
  if (trimmed.length === 0) return false;
  return !/(?:replace-with|placeholder|change[-_ ]?me|example\.invalid|your[-_ ]?(?:key|secret|token)|^\s*(?:user|password)\s*$)/i.test(trimmed);
}

function resolveSafeAppOrigin(value: string | undefined, isProduction: boolean): string | null {
  if (!value || value.length > 2048) return null;
  try {
    const parsed = new URL(value);
    const isLocal = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
    if (isProduction) {
      if (parsed.protocol !== "https:") return null;
      if (isLocal) return null;
    } else {
      if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
    }
    if (parsed.username || parsed.password) return null;
    if (parsed.pathname !== "/" && parsed.pathname !== "") return null;
    if (parsed.search || parsed.hash) return null;
    return parsed.origin;
  } catch {
    return null;
  }
}

export function resolvePaystackConfiguration(
  source: EnvironmentSource = process.env,
): PaystackConfigurationResolution {
  // Time-limited sandbox override for the existing live site. The original
  // PAYSTACK_SECRET_KEY and PAYSTACK_MODE remain untouched and recoverable.
  // Once expired, fail closed: never silently resume real-money checkout.
  const temporarySandboxRequested = source.PAYSTACK_TEMPORARY_SANDBOX_ENABLED === "true";
  const temporaryUntil = source.PAYSTACK_TEMPORARY_SANDBOX_UNTIL ?? "";
  const temporaryUntilMs = Date.parse(temporaryUntil);
  const nowMs = Date.now();
  const temporarySandboxTimeValid =
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(temporaryUntil) &&
    Number.isFinite(temporaryUntilMs);
  const temporarySandboxExpired =
    temporarySandboxRequested && temporarySandboxTimeValid && temporaryUntilMs <= nowMs;
  if (temporarySandboxRequested && (
    !temporarySandboxTimeValid ||
    temporaryUntilMs <= nowMs ||
    temporaryUntilMs - nowMs > 6 * 60 * 60 * 1000 ||
    !source.PAYSTACK_TEMPORARY_SANDBOX_SECRET_KEY?.startsWith("sk_test_") ||
    !source.PAYSTACK_TEMPORARY_SANDBOX_PUBLIC_KEY?.startsWith("pk_test_") ||
    !hasUsableValue(source.PAYSTACK_TEMPORARY_SANDBOX_SECRET_KEY) ||
    !hasUsableValue(source.PAYSTACK_TEMPORARY_SANDBOX_PUBLIC_KEY)
  )) {
    return Object.freeze({
      state: Object.freeze({
        ...invalidState("sandbox", "CONFIGURATION_INVALID"),
        ...(temporarySandboxExpired ? { temporarySandboxExpired: true } : {}),
      }),
      runtime: null,
    });
  }
  const rawMode = (temporarySandboxRequested ? "test" : (source.PAYSTACK_MODE?.trim().toLowerCase() || "disabled")) as PaystackMode;
  if (rawMode === "disabled") {
    return Object.freeze({
      state: state({
        configured: false,
        active: false,
        credentialVersionConfigured: false,
        sourceAddressTrustConfigured: true,
        itnVerificationImplemented: true,
        productionValidationApproved: false,
        environment: "not-configured",
        errorCategory: "NOT_CONFIGURED",
        blockReason: "PAYSTACK_DISABLED",
      }),
      runtime: null,
    });
  }

  if (rawMode !== "test" && rawMode !== "live") {
    return Object.freeze({ state: invalidState("not-configured", "CONFIGURATION_INVALID"), runtime: null });
  }

  const classification = classifyRuntimeEnvironment(source);
  if (!classification.isValid) {
    return Object.freeze({ state: invalidState("not-configured", "CONFIGURATION_INVALID"), runtime: null });
  }

  const isProductionRuntime = classification.runtime === "production";
  const isStagingDemo = classification.runtime === "staging-demo";
  const environment: PaystackEnvironment = rawMode === "live" ? "production" : "sandbox";

  // Temporary sandbox is only valid in the real production runtime, and only
  // with the explicit, unexpired control above. Do not change DB classification.
  if (temporarySandboxRequested && !isProductionRuntime) {
    return Object.freeze({ state: invalidState("sandbox", "CONFIGURATION_INVALID"), runtime: null });
  }
  if (isProductionRuntime && rawMode !== "live" && !temporarySandboxRequested) {
    return Object.freeze({ state: invalidState("production", "CONFIGURATION_INVALID"), runtime: null });
  }

  // In staging-demo, test mode is strictly required (live mode rejected to protect against live money)
  if (isStagingDemo && rawMode !== "test") {
    return Object.freeze({ state: invalidState("sandbox", "CONFIGURATION_INVALID"), runtime: null });
  }

  // In local-demo or test, live mode is strictly rejected
  if ((classification.runtime === "local-demo" || classification.runtime === "test") && rawMode === "live") {
    return Object.freeze({ state: invalidState("production", "CONFIGURATION_INVALID"), runtime: null });
  }

  const secretKey = (temporarySandboxRequested
    ? source.PAYSTACK_TEMPORARY_SANDBOX_SECRET_KEY
    : source.PAYSTACK_SECRET_KEY)?.trim() ?? "";
  if (!hasUsableValue(secretKey)) {
    return Object.freeze({ state: invalidState(environment, "CONFIGURATION_INVALID"), runtime: null });
  }

  // Strict key prefix enforcement everywhere:
  // rawMode === "live" => sk_live_* only
  // rawMode === "test" => sk_test_* only
  if (rawMode === "live" && !secretKey.startsWith("sk_live_")) {
    return Object.freeze({ state: invalidState("production", "CONFIGURATION_INVALID"), runtime: null });
  }
  if (rawMode === "test" && !secretKey.startsWith("sk_test_")) {
    return Object.freeze({ state: invalidState("sandbox", "CONFIGURATION_INVALID"), runtime: null });
  }

  const credentialVersion = temporarySandboxRequested
    ? "temporary-production-sandbox"
    : (source.PAYSTACK_CREDENTIAL_VERSION?.trim() || "v1");
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,79}$/.test(credentialVersion)) {
    return Object.freeze({ state: invalidState(environment, "CONFIGURATION_INVALID"), runtime: null });
  }

  const appOrigin = resolveSafeAppOrigin(source.PAYMENT_APP_ORIGIN, isProductionRuntime);
  if (!appOrigin) {
    return Object.freeze({ state: invalidState(environment, "CONFIGURATION_INVALID"), runtime: null });
  }

  const checkoutPublicEnabled = source.CHECKOUT_PUBLIC_ENABLED === "true";
  const productionValidationApproved = isProductionRuntime ? (checkoutPublicEnabled || temporarySandboxRequested) : true;
  const active = rawMode === "test"
    ? (!isProductionRuntime || temporarySandboxRequested)
    : (rawMode === "live" && checkoutPublicEnabled);

  const blockReason = !active
    ? (isProductionRuntime && !checkoutPublicEnabled ? "CONSOLIDATED_VALIDATION_NOT_APPROVED" : "PAYSTACK_DISABLED")
    : null;

  const runtime: PaystackRuntimeConfiguration = Object.freeze({
    mode: rawMode,
    environment,
    secretKey,
    appOrigin,
    apiBaseUrl: PAYSTACK_API_BASE_URL,
    credentialVersion,
    checkoutAuditVersion: "paystack-redirect-v1",
    configurationFingerprint: environment === "sandbox" ? "paystack-v1:sandbox" : "paystack-v1:production",
    eftChannelEnabled: isPaystackEftChannelApproved(source),
  });

  return Object.freeze({
    state: state({
      configured: true,
      active,
      credentialVersionConfigured: true,
      sourceAddressTrustConfigured: true,
      itnVerificationImplemented: true,
      productionValidationApproved,
      environment,
      errorCategory: "NONE",
      blockReason,
    }),
    runtime,
  });
}

/**
 * Webhook signatures and payment verification must use the same provider
 * environment as checkout. An expired sandbox window must not use live keys.
 */
export function resolvePaystackWebhookSecretKey(
  source: EnvironmentSource = process.env,
): string | null {
  const resolved = resolvePaystackConfiguration(source);
  if (resolved.runtime) return resolved.runtime.secretKey;
  if (source.PAYSTACK_TEMPORARY_SANDBOX_ENABLED === "true") return null;
  return source.PAYSTACK_SECRET_KEY?.trim() || null;
}

/** Replay an already signature-verified inbox event using its original mode.
 * This does not enable new sandbox checkouts or accept sandbox webhooks after
 * cutover. Never verify a stored test transaction with a live secret. */
export function resolvePaystackStoredEventSecretKey(
  environment: "SANDBOX" | "PRODUCTION",
  signatureVerified: boolean,
  source: EnvironmentSource = process.env,
): string | null {
  if (!signatureVerified) return null;
  const candidates = environment === "SANDBOX"
    ? [source.PAYSTACK_TEMPORARY_SANDBOX_SECRET_KEY, source.PAYSTACK_SECRET_KEY]
    : [source.PAYSTACK_SECRET_KEY];
  const prefix = environment === "SANDBOX" ? "sk_test_" : "sk_live_";
  return candidates.map(value => value?.trim()).find(value => value?.startsWith(prefix) && hasUsableValue(value)) ?? null;
}

export function requireActivePaystackConfiguration(
  resolution: PaystackConfigurationResolution = resolvePaystackConfiguration(),
): PaystackRuntimeConfiguration {
  const readiness = evaluatePaystackCheckoutReadiness(resolution.state, {
    adapterPresent: Boolean(resolution.runtime),
    requireAdapterPresent: true,
  });
  if (readiness.reasonCode === "LIVE_CHECKOUT_NOT_AUTHORIZED") {
    throw new PaymentError(
      "PAYMENT_PROVIDER_PRODUCTION_NOT_READY",
      "Paystack production checkout is unavailable until CHECKOUT_PUBLIC_ENABLED is approved.",
    );
  }
  if (readiness.reasonCode === "TEMP_SANDBOX_EXPIRED" || readiness.reasonCode === "PROVIDER_CONFIG_INVALID") {
    throw new PaymentError("PAYMENT_PROVIDER_CONFIGURATION_INVALID", "Paystack configuration is invalid.");
  }
  if (!resolution.runtime || !readiness.ready) {
    throw new PaymentError("PAYMENT_PROVIDER_NOT_CONFIGURED", "Paystack checkout is not configured.");
  }
  return resolution.runtime;
}

export type PaystackCheckoutReadinessReasonCode =
  | "READY"
  | "PROVIDER_DISABLED"
  | "PROVIDER_CONFIG_INVALID"
  | "LIVE_CHECKOUT_NOT_AUTHORIZED"
  | "TEMP_SANDBOX_EXPIRED"
  | "PROVIDER_CHANNEL_NOT_ENABLED";

export type PaystackCheckoutReadinessResult = Readonly<{
  ready: boolean;
  reasonCode: PaystackCheckoutReadinessReasonCode;
  configured: boolean;
  active: boolean;
  environment: SafeProviderConfigurationState["environment"];
  channelRequested: "card" | "eft" | null;
}>;

export type PaystackCheckoutReadinessStateInput = Readonly<{
  code?: string;
  configured: boolean;
  active: boolean;
  environment: SafeProviderConfigurationState["environment"] | string;
  errorCategory: SafeProviderConfigurationState["errorCategory"] | string;
  blockReason?: SafeProviderConfigurationState["blockReason"] | string | null;
  credentialVersionConfigured?: boolean;
  sourceAddressTrustConfigured?: boolean;
  itnVerificationImplemented?: boolean;
  productionValidationApproved?: boolean;
  temporarySandboxExpired?: boolean;
}>;

function normalizePaystackReadinessEnvironment(
  raw: string,
): SafeProviderConfigurationState["environment"] {
  const normalized = raw.trim().toLowerCase();
  if (normalized === "production" || normalized === "live") {
    return "production";
  }
  if (normalized === "sandbox") {
    return "sandbox";
  }
  if (normalized === "test-injected") {
    return "test-injected";
  }
  return "not-configured";
}

/**
 * Authoritative predicate for whether Paystack customer checkout is truly
 * executable (not merely holding API credentials). Does not read or expose
 * any secrets. Used by preflight, quote payment-methods, provider registry,
 * checkout UI, and payment initiation.
 */
export function evaluatePaystackCheckoutReadiness(
  providerState: PaystackCheckoutReadinessStateInput | null | undefined,
  options?: Readonly<{
    adapterPresent?: boolean;
    requireAdapterPresent?: boolean;
    requiredChannel?: "card" | "eft";
    eftChannelApproved?: boolean;
  }>,
): PaystackCheckoutReadinessResult {
  const channelRequested = options?.requiredChannel ?? null;
  if (!providerState) {
    return Object.freeze({
      ready: false,
      reasonCode: "PROVIDER_DISABLED",
      configured: false,
      active: false,
      environment: "not-configured",
      channelRequested,
    });
  }

  const normalizedEnvironment = normalizePaystackReadinessEnvironment(
    providerState.environment,
  );

  const fail = (reasonCode: Exclude<PaystackCheckoutReadinessReasonCode, "READY">): PaystackCheckoutReadinessResult =>
    Object.freeze({
      ready: false,
      reasonCode,
      configured: Boolean(providerState.configured),
      active: Boolean(providerState.active),
      environment: normalizedEnvironment,
      channelRequested,
    });

  if (
    providerState.temporarySandboxExpired === true ||
    providerState.blockReason === "TEMP_SANDBOX_EXPIRED"
  ) {
    return fail("TEMP_SANDBOX_EXPIRED");
  }

  if (providerState.blockReason === "CONSOLIDATED_VALIDATION_NOT_APPROVED") {
    return fail("LIVE_CHECKOUT_NOT_AUTHORIZED");
  }

  if (
    providerState.errorCategory === "CONFIGURATION" ||
    providerState.blockReason === "CONFIGURATION_INVALID" ||
    providerState.credentialVersionConfigured === false ||
    providerState.sourceAddressTrustConfigured === false ||
    providerState.itnVerificationImplemented === false
  ) {
    return fail("PROVIDER_CONFIG_INVALID");
  }

  if (
    providerState.errorCategory === "NOT_CONFIGURED" ||
    providerState.blockReason === "PAYSTACK_DISABLED" ||
    providerState.blockReason === "PROVIDER_DISABLED" ||
    !providerState.configured
  ) {
    return fail("PROVIDER_DISABLED");
  }

  if (options?.requireAdapterPresent && !options.adapterPresent) {
    return fail("PROVIDER_DISABLED");
  }

  if (!providerState.active) {
    if (
      normalizedEnvironment === "production" ||
      providerState.productionValidationApproved === false
    ) {
      return fail("LIVE_CHECKOUT_NOT_AUTHORIZED");
    }
    return fail("PROVIDER_DISABLED");
  }

  if (
    normalizedEnvironment === "production" &&
    providerState.productionValidationApproved !== true
  ) {
    return fail("LIVE_CHECKOUT_NOT_AUTHORIZED");
  }

  if (channelRequested === "eft" && options?.eftChannelApproved !== true) {
    return fail("PROVIDER_CHANNEL_NOT_ENABLED");
  }

  return Object.freeze({
    ready: true,
    reasonCode: "READY",
    configured: true,
    active: true,
    environment: normalizedEnvironment,
    channelRequested,
  });
}

export function evaluatePaystackEftReadiness(
  source: EnvironmentSource = process.env,
): PaystackCheckoutReadinessResult {
  const resolution = resolvePaystackConfiguration(source);
  return evaluatePaystackCheckoutReadiness(resolution.state, {
    adapterPresent: Boolean(resolution.runtime),
    requireAdapterPresent: true,
    requiredChannel: "eft",
    eftChannelApproved: isPaystackEftChannelApproved(source),
  });
}
