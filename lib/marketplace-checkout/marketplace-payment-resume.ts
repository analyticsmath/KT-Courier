import { validatePaystackAuthorizationUrl } from "@/lib/payments/providers/paystack/paystack-client";

type CheckoutAttempt = Readonly<{
  status: string;
  checkoutActionType: string | null;
  redirectUrl: string | null;
  expiresAt: Date | null;
}>;

/**
 * Reuse a previously-authorized provider URL after a browser interruption.
 * Never start a second attempt or redirect an already-settled/unknown payment.
 */
export function restoreMarketplacePaymentRedirect(attempt: CheckoutAttempt | null | undefined, now = new Date()):
  Readonly<{ type: "REDIRECT_GET"; endpoint: string }> | null {
  if (!attempt || attempt.status !== "REQUIRES_ACTION" ||
    attempt.checkoutActionType !== "REDIRECT_GET" ||
    !attempt.redirectUrl || (attempt.expiresAt && attempt.expiresAt <= now)) return null;
  try {
    return Object.freeze({ type: "REDIRECT_GET" as const, endpoint: validatePaystackAuthorizationUrl(attempt.redirectUrl) });
  } catch {
    return null;
  }
}
