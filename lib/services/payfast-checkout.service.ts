import { createHash } from "node:crypto";
import { prisma } from "@/lib/db/prisma";
import { PaymentError } from "@/lib/payments/errors";
import type { ProviderCustomerAction, ProviderCheckoutSessionInput } from "@/lib/payments/providers/payment-provider-adapter";
import {
  createProductionPaymentProviderRegistry,
  type PaymentProviderRegistry,
} from "@/lib/payments/providers/payment-provider-registry";
import { validateProviderResult } from "@/lib/payments/providers/provider-result-validation";
import { buildServerPaymentCallbackUrls, type PaymentCallbackUrls } from "@/lib/payments/return-url-policy";

type CheckoutDependencies = Readonly<{
  registry?: PaymentProviderRegistry;
  callbackUrls?: (paymentPublicReference: string) => PaymentCallbackUrls;
}>;

function customerReference(userId: string): string {
  return `payer_${createHash("sha256").update(userId).digest("hex").slice(0, 20)}`;
}

export async function buildOwnedPayfastCheckoutAction(
  payerId: string,
  attemptReference: string,
  dependencies: CheckoutDependencies = {},
): Promise<ProviderCustomerAction & { type: "FORM_POST" }> {
  const attempt = await prisma.paymentAttempt.findUnique({
    where: { publicReference: attemptReference },
    include: {
      payment: {
        include: {
          user: { select: { id: true, email: true, name: true } },
          order: { select: { orderNumber: true } },
        },
      },
    },
  });
  if (!attempt || attempt.payment.userId !== payerId) {
    throw new PaymentError("PAYMENT_ATTEMPT_NOT_FOUND", "Payment checkout was not found.");
  }
  if (
    attempt.provider !== "PAYFAST"
    || attempt.publicReference !== attemptReference
    || attempt.status !== "REQUIRES_ACTION"
    || attempt.checkoutActionType !== "FORM_POST"
    || attempt.providerEnvironment !== "SANDBOX"
    || attempt.payment.status !== "REQUIRES_ACTION"
    || attempt.payment.latestAttemptNumber !== attempt.attemptNumber
  ) {
    throw new PaymentError("PAYFAST_ATTEMPT_NOT_ACTIONABLE", "Payfast checkout is no longer actionable.");
  }

  const registry = dependencies.registry ?? createProductionPaymentProviderRegistry();
  const adapter = registry.getAdapter("PAYFAST");
  if (
    adapter.checkoutAudit.environment !== attempt.providerEnvironment
    || adapter.checkoutAudit.protocolVersion !== attempt.providerProtocolVersion
    || adapter.checkoutAudit.configurationFingerprint !== attempt.configurationFingerprint
    || adapter.checkoutAudit.credentialVersion !== attempt.providerCredentialVersion
  ) {
    throw new PaymentError("PAYFAST_CHECKOUT_NOT_AVAILABLE", "Payfast configuration changed after checkout preparation.");
  }
  const callbacks = (dependencies.callbackUrls ?? buildServerPaymentCallbackUrls)(attempt.payment.publicReference);
  const request: ProviderCheckoutSessionInput = Object.freeze({
    merchantReference: attempt.merchantReference,
    paymentPublicReference: attempt.payment.publicReference,
    amount: attempt.amount.toFixed(2),
    currency: "ZAR",
    customerReference: customerReference(attempt.payment.user?.id ?? ""),
    customerEmail: attempt.payment.user?.email ?? "",
    ...(attempt.payment.user?.name ? { customerName: attempt.payment.user.name } : {}),
    orderReference: attempt.payment.order?.orderNumber ?? attempt.payment.publicReference,
    returnUrl: callbacks.returnUrl,
    cancelUrl: callbacks.cancelUrl,
    notificationUrl: callbacks.notificationUrl,
    description: `KT Couriers order ${attempt.payment.order?.orderNumber ?? attempt.payment.publicReference}`.slice(0, 160),
    providerOperationKey: attempt.merchantReference,
  });
  const result = validateProviderResult(
    await adapter.createCheckoutSession(request, Object.freeze({
      signal: new AbortController().signal,
      correlationId: attempt.publicReference,
      timeoutMs: 1_000,
    })),
    adapter,
  );
  if (result.status !== "REQUIRES_ACTION" || result.customerAction?.type !== "FORM_POST") {
    throw new PaymentError("PAYFAST_FORM_ACTION_INVALID", "Payfast did not produce an actionable checkout form.");
  }
  return result.customerAction;
}
