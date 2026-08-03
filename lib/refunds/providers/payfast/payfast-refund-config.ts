import { RefundError } from "../../errors";

export const PAYFAST_REFUND_API_ORIGIN = "https://api.payfast.co.za" as const;
export const PAYFAST_REFUND_API_VERSION = "v1" as const;
export const PAYFAST_REFUNDS_REQUIRE_PRODUCTION_VALIDATION = true as const;

export type PayfastRefundRuntimeConfiguration = Readonly<{
  merchantId: string;
  passphrase: string;
  credentialVersion: string;
  apiOrigin: typeof PAYFAST_REFUND_API_ORIGIN;
  apiVersion: typeof PAYFAST_REFUND_API_VERSION;
}>;

export type PayfastRefundConfigurationResolution = Readonly<{
  state: Readonly<{
    known: true;
    configured: boolean;
    networkActive: false;
    blockReason: "PAYFAST_REFUNDS_REQUIRE_PRODUCTION_VALIDATION";
  }>;
  runtime: PayfastRefundRuntimeConfiguration | null;
}>;

function exactSecret(value: string | undefined, maximum: number): string | null {
  if (!value || value !== value.trim() || value.length > maximum || /[\r\n\0]/.test(value)) return null;
  return value;
}

export function resolvePayfastRefundConfiguration(source: Readonly<Record<string, string | undefined>> = process.env): PayfastRefundConfigurationResolution {
  const merchantId = exactSecret(source.PAYFAST_MERCHANT_ID, 100);
  const passphrase = exactSecret(source.PAYFAST_PASSPHRASE, 256);
  const credentialVersion = exactSecret(source.PAYFAST_CREDENTIAL_VERSION, 80);
  const configured = Boolean(merchantId && passphrase && credentialVersion && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,79}$/.test(credentialVersion ?? ""));
  return Object.freeze({
    state: Object.freeze({ known: true, configured, networkActive: false, blockReason: "PAYFAST_REFUNDS_REQUIRE_PRODUCTION_VALIDATION" as const }),
    runtime: configured ? Object.freeze({ merchantId: merchantId!, passphrase: passphrase!, credentialVersion: credentialVersion!, apiOrigin: PAYFAST_REFUND_API_ORIGIN, apiVersion: PAYFAST_REFUND_API_VERSION }) : null,
  });
}

export function requireConfiguredPayfastRefundConfiguration(resolution = resolvePayfastRefundConfiguration()): PayfastRefundRuntimeConfiguration {
  if (!resolution.runtime) throw new RefundError("REFUND_PROVIDER_NOT_READY", "Payfast refund API credentials are not configured.");
  return resolution.runtime;
}

export function assertPayfastRefundNetworkActive(): never {
  throw new RefundError("REFUND_PROVIDER_NOT_READY", "Payfast refund networking requires reviewed production validation.");
}

