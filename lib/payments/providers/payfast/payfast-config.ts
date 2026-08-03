import { PaymentError } from "../../errors";
import type { SafeProviderConfigurationState } from "../provider-config";

export const PAYFAST_PROVIDER_IDENTITY = "South African Payfast by Network" as const;
export const PAYFAST_PRODUCTION_VALIDATION_APPROVED = false as const;
export const PAYFAST_PROCESSING_ENDPOINTS = Object.freeze({
  sandbox: "https://sandbox.payfast.co.za/eng/process",
  production: "https://www.payfast.co.za/eng/process",
} as const);

export type PayfastMode = "disabled" | "sandbox" | "production";
export type PayfastEnvironment = Exclude<PayfastMode, "disabled">;

export type PayfastRuntimeConfiguration = Readonly<{
  mode: PayfastEnvironment;
  environment: PayfastEnvironment;
  merchantId: string;
  merchantKey: string;
  passphrase: string;
  appOrigin: string;
  processingEndpoint: (typeof PAYFAST_PROCESSING_ENDPOINTS)[PayfastEnvironment];
  signatureVersion: "payfast-md5-v1";
  requestFieldVersion: "payfast-custom-checkout-v1";
  configurationFingerprint: "payfast-v1:sandbox" | "payfast-v1:production";
  credentialVersion: string;
}>;

export type PayfastConfigurationResolution = Readonly<{
  state: SafeProviderConfigurationState;
  runtime: PayfastRuntimeConfiguration | null;
}>;

type PayfastEnvironmentSource = Readonly<Record<string, string | undefined>>;

function state(args: Omit<SafeProviderConfigurationState, "code">): SafeProviderConfigurationState {
  return Object.freeze({ code: "PAYFAST", ...args });
}

function invalidState(environment: "sandbox" | "production" | "not-configured" = "not-configured") {
  return state({
    configured: false,
    active: false,
    credentialVersionConfigured: false,
    sourceAddressTrustConfigured: false,
    itnVerificationImplemented: true,
    productionValidationApproved: PAYFAST_PRODUCTION_VALIDATION_APPROVED,
    environment,
    errorCategory: "CONFIGURATION",
    blockReason: "CONFIGURATION_INVALID",
  });
}

function exactSecret(value: string | undefined, maximum: number): string | null {
  if (!value || value !== value.trim() || value.length > maximum || /[\r\n\0]/.test(value)) return null;
  return value;
}

function resolveOrigin(value: string | undefined): string | null {
  if (!value || value.length > 2_048) return null;
  try {
    const parsed = new URL(value);
    const isHttpAllowed = parsed.protocol === "http:" && (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1" || process.env.KT_RUNTIME_ENV === "e2e");
    if (
      (parsed.protocol !== "https:" && !isHttpAllowed)
      || parsed.username
      || parsed.password
      || parsed.pathname !== "/"
      || parsed.search
      || parsed.hash
    ) return null;
    return parsed.origin;
  } catch {
    return null;
  }
}

export function resolvePayfastConfiguration(
  source: PayfastEnvironmentSource = process.env,
): PayfastConfigurationResolution {
  const rawMode = source.PAYFAST_MODE?.trim().toLowerCase() || "disabled";
  if (rawMode === "disabled") {
    return Object.freeze({
      state: state({
        configured: false,
        active: false,
        credentialVersionConfigured: false,
        sourceAddressTrustConfigured: false,
        itnVerificationImplemented: true,
        productionValidationApproved: PAYFAST_PRODUCTION_VALIDATION_APPROVED,
        environment: "not-configured",
        errorCategory: "NOT_CONFIGURED",
        blockReason: "PAYFAST_DISABLED",
      }),
      runtime: null,
    });
  }
  if (rawMode !== "sandbox" && rawMode !== "production") {
    return Object.freeze({ state: invalidState(), runtime: null });
  }

  const merchantId = exactSecret(source.PAYFAST_MERCHANT_ID, 100);
  const merchantKey = exactSecret(source.PAYFAST_MERCHANT_KEY, 100);
  const passphrase = exactSecret(source.PAYFAST_PASSPHRASE, 256);
  const credentialVersion = exactSecret(source.PAYFAST_CREDENTIAL_VERSION, 80);
  const appOrigin = resolveOrigin(source.PAYMENT_APP_ORIGIN);
  if (!merchantId || !merchantKey || !passphrase || !credentialVersion || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,79}$/.test(credentialVersion) || !appOrigin) {
    return Object.freeze({ state: invalidState(rawMode), runtime: null });
  }

  const runtime = Object.freeze({
    mode: rawMode,
    environment: rawMode,
    merchantId,
    merchantKey,
    passphrase,
    appOrigin,
    processingEndpoint: PAYFAST_PROCESSING_ENDPOINTS[rawMode],
    signatureVersion: "payfast-md5-v1" as const,
    requestFieldVersion: "payfast-custom-checkout-v1" as const,
    configurationFingerprint: rawMode === "sandbox" ? "payfast-v1:sandbox" as const : "payfast-v1:production" as const,
    credentialVersion,
  });
  const sourceAddressTrustConfigured = source.PAYMENT_PROXY_MODE?.trim().toLowerCase() === "single_trusted_proxy";
  return Object.freeze({
    state: state({
      configured: true,
      active: rawMode === "sandbox",
      credentialVersionConfigured: true,
      sourceAddressTrustConfigured,
      itnVerificationImplemented: true,
      productionValidationApproved: PAYFAST_PRODUCTION_VALIDATION_APPROVED,
      environment: rawMode,
      errorCategory: "NONE",
      blockReason: rawMode === "production" ? "CONSOLIDATED_VALIDATION_NOT_APPROVED" : null,
    }),
    runtime,
  });
}

export function requireActivePayfastConfiguration(
  resolution: PayfastConfigurationResolution = resolvePayfastConfiguration(),
): PayfastRuntimeConfiguration {
  if (resolution.state.environment === "production" && resolution.state.configured) {
    throw new PaymentError("PAYFAST_PRODUCTION_NOT_READY", "Payfast production checkout is unavailable until consolidated validation is approved.");
  }
  if (resolution.state.errorCategory === "CONFIGURATION") {
    throw new PaymentError("PAYFAST_CONFIGURATION_INVALID", "Payfast configuration is invalid.");
  }
  if (!resolution.runtime || !resolution.state.active) {
    throw new PaymentError("PAYFAST_NOT_CONFIGURED", "Payfast checkout is not configured.");
  }
  return resolution.runtime;
}
