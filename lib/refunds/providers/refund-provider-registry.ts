import type { PaymentProviderCode } from "@/lib/payments/types";
import { RefundError } from "../errors";
import type { RefundProviderAdapter } from "./refund-provider-adapter";

export const KNOWN_REFUND_PROVIDER_CODES = Object.freeze(["PAYFAST"] as const);

export class RefundProviderRegistry {
  readonly #adapters = new Map<PaymentProviderCode, RefundProviderAdapter>();

  constructor(adapters: readonly RefundProviderAdapter[] = []) {
    for (const adapter of adapters) {
      if (!(KNOWN_REFUND_PROVIDER_CODES as readonly string[]).includes(adapter.code) || this.#adapters.has(adapter.code)) {
        throw new RefundError("REFUND_PROVIDER_NOT_READY", "Refund provider registry configuration is invalid.");
      }
      this.#adapters.set(adapter.code, adapter);
    }
  }

  getAdapter(code: PaymentProviderCode): RefundProviderAdapter {
    const adapter = this.#adapters.get(code);
    if (!adapter) throw new RefundError("REFUND_PROVIDER_NOT_READY", "Refund provider is unavailable.");
    return adapter;
  }
}

