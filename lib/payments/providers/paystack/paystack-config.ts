import { PaymentError } from "../../errors";
import type { SafeProviderConfigurationState } from "../provider-config";

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
}>;

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
  const rawMode = (source.PAYSTACK_MODE?.trim().toLowerCase() || "disabled") as PaystackMode;
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

  const isProduction = source.NODE_ENV === "production" && source.KT_RUNTIME_ENV !== "e2e";
  const environment: PaystackEnvironment = rawMode === "live" ? "production" : "sandbox";

  // In production, live mode is strictly required
  if (isProduction && rawMode !== "live") {
    return Object.freeze({ state: invalidState("production", "CONFIGURATION_INVALID"), runtime: null });
  }

  const secretKey = source.PAYSTACK_SECRET_KEY?.trim() ?? "";
  if (!hasUsableValue(secretKey)) {
    return Object.freeze({ state: invalidState(environment, "CONFIGURATION_INVALID"), runtime: null });
  }

  // Live keys must begin with sk_live_ in production; test keys with sk_test_ in sandbox
  if (isProduction && !secretKey.startsWith("sk_live_")) {
    return Object.freeze({ state: invalidState("production", "CONFIGURATION_INVALID"), runtime: null });
  }

  const credentialVersion = source.PAYSTACK_CREDENTIAL_VERSION?.trim() || "v1";
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,79}$/.test(credentialVersion)) {
    return Object.freeze({ state: invalidState(environment, "CONFIGURATION_INVALID"), runtime: null });
  }

  const appOrigin = resolveSafeAppOrigin(source.PAYMENT_APP_ORIGIN, isProduction);
  if (!appOrigin) {
    return Object.freeze({ state: invalidState(environment, "CONFIGURATION_INVALID"), runtime: null });
  }

  const checkoutPublicEnabled = source.CHECKOUT_PUBLIC_ENABLED === "true";
  const productionValidationApproved = isProduction ? checkoutPublicEnabled : true;
  const active = rawMode === "test" || (rawMode === "live" && checkoutPublicEnabled);

  const blockReason = !active
    ? (isProduction && !checkoutPublicEnabled ? "CONSOLIDATED_VALIDATION_NOT_APPROVED" : "PAYSTACK_DISABLED")
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

export function requireActivePaystackConfiguration(
  resolution: PaystackConfigurationResolution = resolvePaystackConfiguration(),
): PaystackRuntimeConfiguration {
  if (resolution.state.blockReason === "CONSOLIDATED_VALIDATION_NOT_APPROVED") {
    throw new PaymentError(
      "PAYMENT_PROVIDER_PRODUCTION_NOT_READY",
      "Paystack production checkout is unavailable until CHECKOUT_PUBLIC_ENABLED is approved.",
    );
  }
  if (resolution.state.errorCategory === "CONFIGURATION") {
    throw new PaymentError("PAYMENT_PROVIDER_CONFIGURATION_INVALID", "Paystack configuration is invalid.");
  }
  if (!resolution.runtime || !resolution.state.active) {
    throw new PaymentError("PAYMENT_PROVIDER_NOT_CONFIGURED", "Paystack checkout is not configured.");
  }
  return resolution.runtime;
}
