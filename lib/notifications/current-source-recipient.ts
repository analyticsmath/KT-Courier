import type { Prisma } from "@prisma/client";
import { requiredDomainDefinition } from "./required-domain-definitions";
import { resolveRequiredDomainPayload } from "./required-domain-payload";
import { NotificationPolicyError } from "./contracts";
import { guestContactSubjectKey } from "./guest-recipient";

/** Recheck tenant, assignment, conversation and financial ownership immediately before send. */
export async function currentRequiredSourceRecipient(db: Prisma.TransactionClient, sourceReceiptId: string | null, userId: string) {
  if (!sourceReceiptId) return true; // Other approved event families retain their own authority.
  const receipt = await db.notificationSourceReceipt.findUnique({ where: { id: sourceReceiptId } });
  if (!receipt) return false;
  const definition = requiredDomainDefinition(receipt.sourceAuthority, receipt.sourceEventType);
  if (!definition) return true;
  const intent = await db.notificationEventIntent.findUnique({ where: { operationId: receipt.sourceEventId } });
  if (!intent || intent.sourceAuthority !== receipt.sourceAuthority || intent.eventType !== receipt.sourceEventType || intent.aggregateReference !== receipt.aggregateReference) return false;
  try {
    const payload = await resolveRequiredDomainPayload(db, intent);
    const field = definition.subject === "STORE_OWNER" ? "storeOwnerUserId" : definition.subject === "ASSIGNED_DRIVER" ? "driverUserId" : definition.subject === "EVENT_ACTOR" ? "actorUserId" : "customerUserId";
    if (payload[field] === null && typeof payload.checkoutReference === "string") {
      const checkout = await db.marketplaceCheckout.findUnique({ where: { publicReference: payload.checkoutReference }, select: { customerUserId: true, contactSnapshotId: true } });
      return !!checkout && !checkout.customerUserId && !!checkout.contactSnapshotId && guestContactSubjectKey(checkout.contactSnapshotId) === userId;
    }
    return payload[field] === userId;
  } catch (error) {
    if (error instanceof NotificationPolicyError) return false;
    throw error;
  }
}
