import { prisma } from "@/lib/db/prisma";
import { deliverSecurityEmail } from "@/lib/notifications/security-email-delivery";

/**
 * Completion-critical OTPs must not claim success merely because an outbox
 * record was queued. The same immutable delivery is safe across retries and
 * concurrent background workers because claimEmailAttempt owns idempotency.
 *
 * The provider's acceptance is not recipient inbox receipt.
 */
export async function dispatchIssuedDeliveryOtpEmail(operationId: string): Promise<
  Readonly<{ accepted: boolean; status: string }>
> {
  const intent = await prisma.notificationEventIntent.findUnique({
    where: { operationId },
    select: { id: true, sourceAuthority: true, eventType: true },
  });
  if (!intent || intent.sourceAuthority !== "AUTHENTICATION_SECURITY" || !["DELIVERY_OTP", "PICKUP_OTP"].includes(intent.eventType)) {
    return { accepted: false, status: "INTENT_MISSING" };
  }
  const delivery = await prisma.notificationDelivery.findUnique({
    where: { messageId_channel: { messageId: intent.id, channel: "EMAIL" } },
    select: { id: true },
  });
  if (!delivery) return { accepted: false, status: "DELIVERY_MISSING" };
  const result = await deliverSecurityEmail(delivery.id);
  return { accepted: result.accepted, status: result.status };
}
