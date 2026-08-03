import { createHash, randomUUID } from "node:crypto";
import { prepareOrderPayment } from "@/lib/services/payment-preparation.service";
import { createProviderCheckoutSession } from "@/lib/services/payment-provider-session.service";
import type { PaymentWebhookNormalizedStatusCode } from "@/lib/payments/types";
import type { VerifiedPayfastItn } from "@/lib/services/payfast-itn-verification.service";
import type { ResolvedPayfastItnAttempt } from "@/lib/services/payfast-itn-resolution.service";
import { createPayableOrder, paymentPrisma } from "./payment-fixtures";
import { payfastIntegrationCallbacks, payfastIntegrationRegistry } from "./payfast-fixtures";

export async function createPhase12Attempt() {
  const fixture = await createPayableOrder();
  const payment = await prepareOrderPayment({ id: fixture.user.id, email: fixture.user.email }, { orderId: fixture.order.id, idempotencyKey: `${fixture.tag}:phase12:prepare` });
  const session = await createProviderCheckoutSession({ id: fixture.user.id }, { paymentId: payment.id, provider: "PAYFAST", idempotencyKey: `${fixture.tag}:phase12:checkout` }, { registry: payfastIntegrationRegistry(), callbackUrls: payfastIntegrationCallbacks });
  const attempt = await paymentPrisma.paymentAttempt.findUniqueOrThrow({ where: { id: session.attempt.id }, include: { payment: true } });
  return { fixture, payment, session, attempt: attempt as unknown as ResolvedPayfastItnAttempt };
}

export function verifiedEvent(attempt: ResolvedPayfastItnAttempt, status: PaymentWebhookNormalizedStatusCode = "COMPLETE", options: { providerPaymentId?: string; fingerprintSeed?: string } = {}): VerifiedPayfastItn {
  const providerPaymentId = options.providerPaymentId ?? `pf-${randomUUID()}`;
  const providerStatus = status === "UNKNOWN" ? "FUTURE_STATUS" : status;
  const seed = options.fingerprintSeed ? `${attempt.id}:${options.fingerprintSeed}` : randomUUID();
  const fingerprint = createHash("sha256").update(seed).digest("hex");
  const safePayloadSnapshot = Object.freeze({ merchantReference: attempt.merchantReference, providerPaymentId, providerStatus, amountGross: attempt.amount.toFixed(2), amountFee: null, amountNet: null, itemReference: null, fieldCount: 6, unknownFieldCount: 0, protocolVersion: "payfast-itn-v1" });
  return Object.freeze({
    kind: "VERIFIED",
    receipt: Object.freeze({ fingerprint, environment: attempt.providerEnvironment, merchantReference: attempt.merchantReference, providerPaymentId, providerStatus, normalizedStatus: status, sourceAddress: "196.1.2.3", credentialVersion: attempt.providerCredentialVersion, paymentId: attempt.paymentId, attemptId: attempt.id, safePayloadSnapshot, unknownFieldCount: 0, sourceAddressVerified: true, signatureVerified: true, merchantVerified: true, amountVerified: true, providerDataVerified: true }),
    fields: Object.freeze({ merchantReference: attempt.merchantReference, providerPaymentId, providerStatus, amountGross: attempt.amount.toFixed(2), merchantId: "integration-merchant-id", signature: "0".repeat(32), amountFee: null, amountNet: null, recurringTokenFingerprint: null, itemReference: null, unknownFieldCount: 0, safePayloadSnapshot }),
    attempt,
    verifiedAt: new Date(),
  });
}
