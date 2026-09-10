import { RefundError } from "../../errors";
import type {
  ProviderRefundContext,
  ProviderRefundInput,
  ProviderRefundQueryInput,
  ProviderRefundQueryResult,
  ProviderRefundResult,
  RefundProviderAdapter,
  RefundProviderResultStatus,
} from "../refund-provider-adapter";
import { PaystackClient, zarToSubunitCents } from "@/lib/payments/providers/paystack/paystack-client";
import { resolvePaystackConfiguration } from "@/lib/payments/providers/paystack/paystack-config";

export const PAYSTACK_REFUND_CAPABILITIES = Object.freeze({
  supportsFullRefund: true,
  supportsPartialRefund: true,
  supportsMultiplePartialRefunds: true,
  supportsSandboxRefunds: true,
  supportsStatusQuery: true,
  supportsIdempotentCreate: false,
  requiresCustomerBankData: false,
});

export class PaystackRefundAdapter implements RefundProviderAdapter {
  readonly code = "PAYSTACK" as const;
  readonly capabilities = PAYSTACK_REFUND_CAPABILITIES;

  constructor(
    private readonly client?: PaystackClient,
  ) {}

  private getClient(): PaystackClient {
    if (this.client) return this.client;
    const config = resolvePaystackConfiguration();
    const secretKey = config.runtime?.secretKey ?? process.env.PAYSTACK_SECRET_KEY?.trim();
    if (!secretKey) {
      throw new RefundError("REFUND_PROVIDER_NOT_READY", "Paystack secret key is not configured for refunds.");
    }
    return new PaystackClient({ secretKey });
  }

  mapRawStatus(rawStatus: string): { status: RefundProviderResultStatus; definitive: boolean } {
    const s = (rawStatus || "").toLowerCase();
    if (s === "processed" || s === "success") {
      return { status: "SUCCEEDED", definitive: true };
    }
    if (s === "failed") {
      return { status: "FAILED", definitive: true };
    }
    if (s === "needs-attention" || s === "needs_attention") {
      return { status: "NEEDS_ATTENTION", definitive: true };
    }
    if (s === "pending" || s === "processing") {
      return { status: "PROCESSING", definitive: false };
    }
    return { status: "UNKNOWN", definitive: false };
  }

  async createRefund(input: ProviderRefundInput, context: ProviderRefundContext): Promise<ProviderRefundResult> {
    if (context.signal.aborted) throw new DOMException("Paystack refund call aborted.", "AbortError");
    const client = this.getClient();
    const amountCents = zarToSubunitCents(input.amount);

    const data = await client.createRefund({
      transaction: input.providerPaymentId,
      amountCents,
      currency: "ZAR",
      merchantNote: input.reasonCode,
    }, context.signal);

    const rawStatus = (data.status || "").toLowerCase();
    const { status, definitive } = this.mapRawStatus(rawStatus);

    return Object.freeze({
      status,
      providerRefundId: String(data.id),
      providerPaymentId: input.providerPaymentId,
      providerStatusCode: data.status,
      safeProviderStatus: rawStatus,
      safeMetadata: Object.freeze({
        deductedAmount: data.deducted_amount,
        currency: data.currency,
      }),
      definitive,
    });
  }

  async queryRefund(input: ProviderRefundQueryInput, context: ProviderRefundContext): Promise<ProviderRefundQueryResult> {
    if (context.signal.aborted) throw new DOMException("Paystack refund query aborted.", "AbortError");
    const client = this.getClient();

    const data = await client.getRefund(input.providerRefundId, context.signal);
    const rawStatus = (data.status || "").toLowerCase();
    const { status, definitive } = this.mapRawStatus(rawStatus);

    return Object.freeze({
      status,
      providerRefundId: String(data.id),
      providerStatusCode: data.status,
      safeProviderStatus: rawStatus,
      safeMetadata: Object.freeze({
        deductedAmount: data.deducted_amount,
        currency: data.currency,
      }),
      definitive,
    });
  }
}
