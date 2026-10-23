import { createHash } from "node:crypto";
import { queueSecurityNotification } from "@/lib/notifications/security-delivery";
import { dispatchIssuedDeliveryOtpEmail } from "@/lib/services/delivery-otp-email-dispatch.service";

/**
 * Canonical, encrypted outbound security-notification boundary for existing
 * marketplace pickup challenges. The store order owns the challenge; this
 * adapter never issues a second code or changes custody.
 */
export async function sendStorePickupChallengeEmail(input: Readonly<{
  storeOrderReference: string;
  pickupOperationId: string;
  recipientUserId: string;
  code: string;
  expiresAt: Date;
}>): Promise<Readonly<{ status: string }>> {
  const operationId = `store-pickup-email:${createHash("sha256").update(input.pickupOperationId).digest("hex").slice(0,32)}`;
  await queueSecurityNotification({
    eventType: "STORE_PICKUP_CODE",
    operationId,
    subjectUserId: input.recipientUserId,
    aggregateReference: input.storeOrderReference,
    expiresAt: input.expiresAt,
    values: { otp: input.code, orderNumber: input.storeOrderReference, pickupOperationId: input.pickupOperationId },
  });
  return { status: (await dispatchIssuedDeliveryOtpEmail(operationId)).status };
}
