import type { PaymentProviderCode } from "../types";

export type SafeProviderConfigurationState = Readonly<{
  code: PaymentProviderCode;
  configured: boolean;
  active: boolean;
  credentialVersionConfigured: boolean;
  sourceAddressTrustConfigured: boolean;
  itnVerificationImplemented: boolean;
  productionValidationApproved: boolean;
  environment: "not-configured" | "test-injected" | "sandbox" | "production";
  errorCategory: "NOT_CONFIGURED" | "CONFIGURATION" | "NONE";
  blockReason:
    | "PAYFAST_DISABLED"
    | "CONFIGURATION_INVALID"
    | "PAYFAST_SOURCE_ADDRESS_TRUST_NOT_CONFIGURED"
    | "CONSOLIDATED_VALIDATION_NOT_APPROVED"
    | null;
}>;

export function unconfiguredProviderState(code: PaymentProviderCode): SafeProviderConfigurationState {
  return Object.freeze({
    code,
    configured: false,
    active: false,
    credentialVersionConfigured: false,
    sourceAddressTrustConfigured: false,
    itnVerificationImplemented: true,
    productionValidationApproved: false,
    environment: "not-configured",
    errorCategory: "NOT_CONFIGURED",
    blockReason: "PAYFAST_DISABLED",
  });
}

export function injectedTestProviderState(code: PaymentProviderCode): SafeProviderConfigurationState {
  return Object.freeze({
    code,
    configured: true,
    active: true,
    credentialVersionConfigured: true,
    sourceAddressTrustConfigured: true,
    itnVerificationImplemented: true,
    productionValidationApproved: false,
    environment: "test-injected",
    errorCategory: "NONE",
    blockReason: null,
  });
}
