import { prisma } from "@/lib/db/prisma";

export type AdminHandoverEmailEvidence = Readonly<{
  reference: string;
  stage: "PICKUP" | "DELIVERY";
  requestedAt: Date;
  deliveryStatus: string;
  provider: string | null;
  lastAttemptStatus: string | null;
  failureClass: string | null;
  safeProviderCode: string | null;
}>;

/**
 * Read-only operational email evidence; no message bodies, raw addresses,
 * one-time passwords, hashes, provider IDs or encrypted payloads are exposed.
 * The caller is an ORDERS_READ-authorized administrative order page.
 */
export async function listAdminHandoverEmailEvidence(orderId: string): Promise<AdminHandoverEmailEvidence[]> {
  const intents = await prisma.notificationEventIntent.findMany({
    where: {
      aggregateReference: orderId,
      sourceAuthority: "AUTHENTICATION_SECURITY",
      eventType: { in: ["PICKUP_OTP", "DELIVERY_OTP"] },
    },
    orderBy: { createdAt: "desc" },
    take: 12,
    select: { id: true, eventType: true, createdAt: true },
  });
  if (!intents.length) return [];
  const deliveries = await prisma.notificationDelivery.findMany({
    where: { messageId: { in: intents.map(intent => intent.id) }, channel: "EMAIL" },
    select: { id: true, messageId: true, status: true, provider: true, eligibilityReason: true },
  });
  const attempts = deliveries.length ? await prisma.notificationDeliveryAttempt.findMany({
    where: { deliveryId: { in: deliveries.map(delivery => delivery.id) } },
    orderBy: { startedAt: "desc" },
    select: { deliveryId: true, status: true, failureClass: true, safeProviderCode: true },
  }) : [];
  const deliveriesByIntent = new Map(deliveries.map(row => [row.messageId, row]));
  const lastAttemptByDelivery = new Map<string, typeof attempts[number]>();
  for (const attempt of attempts) {
    if (!lastAttemptByDelivery.has(attempt.deliveryId)) lastAttemptByDelivery.set(attempt.deliveryId, attempt);
  }
  return intents.map(intent => {
    const delivery = deliveriesByIntent.get(intent.id);
    const attempt = delivery ? lastAttemptByDelivery.get(delivery.id) : null;
    return {
      reference: intent.id,
      stage: intent.eventType === "PICKUP_OTP" ? "PICKUP" : "DELIVERY",
      requestedAt: intent.createdAt,
      deliveryStatus: String(delivery?.status ?? "NOT_QUEUED"),
      provider: delivery?.provider ?? null,
      lastAttemptStatus: attempt ? String(attempt.status) : null,
      failureClass: attempt?.failureClass ? String(attempt.failureClass) : null,
      safeProviderCode: attempt?.safeProviderCode ?? delivery?.eligibilityReason ?? null,
    };
  });
}
