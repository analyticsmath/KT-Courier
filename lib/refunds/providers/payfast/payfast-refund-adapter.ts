import { RefundError } from "../../errors";
import type {
  ProviderRefundContext,
  ProviderRefundInput,
  ProviderRefundQueryInput,
  ProviderRefundQueryResult,
  ProviderRefundResult,
  RefundProviderAdapter,
} from "../refund-provider-adapter";
import type { PayfastRefundAmountSerializer } from "./payfast-refund-amount";
import type { PayfastRefundRuntimeConfiguration } from "./payfast-refund-config";
import { buildPayfastRefundRequest } from "./payfast-refund-request";
import { normalizePayfastRefundResponse } from "./payfast-refund-response";

export const PAYFAST_REFUND_CAPABILITIES = Object.freeze({
  supportsFullRefund: true,
  supportsPartialRefund: true,
  supportsMultiplePartialRefunds: true,
  supportsSandboxRefunds: false,
  supportsStatusQuery: false,
  supportsIdempotentCreate: false,
  requiresCustomerBankData: false,
});

type PayfastRefundTransport = (request: Readonly<{
  url: string;
  method: "POST";
  headers: Readonly<Record<string, string>>;
  body: string;
  signal: AbortSignal;
}>) => Promise<Readonly<{ status: number; redirected: boolean; body: unknown }>>;

export class PayfastRefundAdapter implements RefundProviderAdapter {
  readonly code = "PAYFAST" as const;
  readonly capabilities = PAYFAST_REFUND_CAPABILITIES;

  constructor(
    private readonly configuration: PayfastRefundRuntimeConfiguration,
    private readonly injected?: Readonly<{ transport: PayfastRefundTransport; amountSerializer: PayfastRefundAmountSerializer; now: () => Date }>,
  ) {}

  async createRefund(input: ProviderRefundInput, context: ProviderRefundContext): Promise<ProviderRefundResult> {
    if (!this.injected) throw new RefundError("REFUND_PROVIDER_NOT_READY", "Payfast refund network execution is validation-locked.");
    if (context.signal.aborted) throw new DOMException("Payfast refund call aborted.", "AbortError");
    const timestamp = this.injected.now().toISOString();
    const request = buildPayfastRefundRequest(input, this.configuration, { timestamp, amountSerializer: this.injected.amountSerializer });
    const response = await this.injected.transport({ ...request, signal: context.signal });
    if (response.redirected) throw new RefundError("REFUND_PROVIDER_RESPONSE_INVALID", "Payfast refund API redirects are not permitted.");
    return normalizePayfastRefundResponse(response.body, response.status);
  }

  async queryRefund(input: ProviderRefundQueryInput, context: ProviderRefundContext): Promise<ProviderRefundQueryResult> {
    void input;
    void context;
    return Object.freeze({ status: "UNKNOWN", providerStatusCode: "PAYFAST_QUERY_PROTOCOL_UNRESOLVED", safeMetadata: Object.freeze({ protocolMappingReviewed: false }), definitive: false });
  }
}
