import type { SafeProviderJson } from "@/lib/payments/provider-snapshot-policy";
import type { PaymentProviderCode } from "@/lib/payments/types";

export type RefundProviderCapabilities = Readonly<{
  supportsFullRefund: boolean;
  supportsPartialRefund: boolean;
  supportsMultiplePartialRefunds: boolean;
  supportsSandboxRefunds: boolean;
  supportsStatusQuery: boolean;
  supportsIdempotentCreate: boolean;
  requiresCustomerBankData: boolean;
}>;

export type ProviderRefundContext = Readonly<{
  signal: AbortSignal;
  correlationId: string;
  timeoutMs: number;
}>;

export type ProviderRefundInput = Readonly<{
  refundPublicReference: string;
  paymentPublicReference: string;
  providerPaymentId: string;
  amount: string;
  currency: "ZAR";
  reasonCode: string;
  providerOperationKey: string;
}>;

export type ProviderRefundQueryInput = Readonly<{
  refundPublicReference: string;
  providerRefundId: string;
}>;

export type RefundProviderResultStatus = "SUCCEEDED" | "PROCESSING" | "FAILED" | "UNKNOWN";

export type ProviderRefundResult = Readonly<{
  status: RefundProviderResultStatus;
  providerRefundId?: string;
  providerPaymentId?: string;
  providerStatusCode?: string;
  safeProviderStatus?: string;
  safeMetadata?: Readonly<Record<string, SafeProviderJson>>;
  definitive: boolean;
}>;

export type ProviderRefundQueryResult = ProviderRefundResult;

export interface RefundProviderAdapter {
  readonly code: PaymentProviderCode;
  readonly capabilities: RefundProviderCapabilities;

  createRefund(input: ProviderRefundInput, context: ProviderRefundContext): Promise<ProviderRefundResult>;
  queryRefund?(input: ProviderRefundQueryInput, context: ProviderRefundContext): Promise<ProviderRefundQueryResult>;
}

export class DeterministicRefundProviderAdapter implements RefundProviderAdapter {
  readonly code: PaymentProviderCode;
  readonly capabilities: RefundProviderCapabilities;

  constructor(
    code: PaymentProviderCode,
    private readonly createResult: ProviderRefundResult | ((input: ProviderRefundInput) => ProviderRefundResult),
    private readonly queryResult?: ProviderRefundQueryResult | ((input: ProviderRefundQueryInput) => ProviderRefundQueryResult),
  ) {
    this.code = code;
    this.capabilities = Object.freeze({
      supportsFullRefund: true,
      supportsPartialRefund: true,
      supportsMultiplePartialRefunds: true,
      supportsSandboxRefunds: true,
      supportsStatusQuery: Boolean(queryResult),
      supportsIdempotentCreate: true,
      requiresCustomerBankData: false,
    });
  }

  async createRefund(input: ProviderRefundInput, context: ProviderRefundContext): Promise<ProviderRefundResult> {
    if (context.signal.aborted) throw new DOMException("Refund provider call aborted.", "AbortError");
    const result = typeof this.createResult === "function" ? this.createResult(input) : this.createResult;
    return Object.freeze({ ...result });
  }

  async queryRefund(input: ProviderRefundQueryInput, context: ProviderRefundContext): Promise<ProviderRefundQueryResult> {
    if (context.signal.aborted) throw new DOMException("Refund provider query aborted.", "AbortError");
    if (!this.queryResult) return Object.freeze({ status: "UNKNOWN", providerStatusCode: "QUERY_UNAVAILABLE", definitive: false });
    const result = typeof this.queryResult === "function" ? this.queryResult(input) : this.queryResult;
    return Object.freeze({ ...result });
  }
}

