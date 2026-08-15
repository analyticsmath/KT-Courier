import { PaymentError } from "@/lib/payments/errors";
import { checkRateLimit } from "@/lib/security/rate-limit";

const GLOBAL_POLICY = Object.freeze({ max: 600, windowMs: 60_000, distributedRequired: true });
const SOURCE_POLICY = Object.freeze({ max: 180, windowMs: 60_000, distributedRequired: true });
const MAX_CONCURRENT_REQUESTS = 16;
let activeRequests = 0;

export async function beginPayfastItnRequest(): Promise<() => void> {
  const globalCheck = await checkRateLimit("payfast-itn:global", GLOBAL_POLICY);
  if (!globalCheck.ok || activeRequests >= MAX_CONCURRENT_REQUESTS) {
    throw new PaymentError("PAYFAST_APPLICATION_UNAVAILABLE", "Payfast ITN intake is temporarily busy.", true);
  }
  activeRequests += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    activeRequests = Math.max(0, activeRequests - 1);
  };
}

export async function assertPayfastSourceRateLimit(sourceAddress: string): Promise<void> {
  const sourceCheck = await checkRateLimit(`payfast-itn:source:${sourceAddress}`, SOURCE_POLICY);
  if (!sourceCheck.ok) {
    throw new PaymentError("PAYFAST_APPLICATION_UNAVAILABLE", "Payfast ITN source rate limit was reached.", true);
  }
}
