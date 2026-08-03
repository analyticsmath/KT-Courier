import type { PaymentProviderEnvironment } from "@/lib/payments/types";

// Provider-controlled hostnames are pinned in code. Resolved IP addresses are
// deliberately not copied into source control and caller-supplied hosts are
// never accepted.
export const PAYFAST_SOURCE_HOSTS: Readonly<Record<PaymentProviderEnvironment, readonly string[]>> = Object.freeze({
  SANDBOX: Object.freeze(["sandbox.payfast.co.za"]),
  PRODUCTION: Object.freeze([
    "ips.payfast.co.za",
    "www.payfast.co.za",
    "api.payfast.co.za",
    "w1w.payfast.co.za",
    "w2w.payfast.co.za",
  ]),
});
