import type { Prisma } from "@prisma/client";
import { NotificationPolicyError } from "./contracts";

export const guestContactSubjectKey = (contactSnapshotId: string) => `guest-checkout-contact:${contactSnapshotId}`;
export const guestContactIdFromSubject = (subjectKey: string) => subjectKey.startsWith("guest-checkout-contact:") ? subjectKey.slice("guest-checkout-contact:".length) : null;

/** Re-resolve on every delivery; a replaced contact or claimed checkout cannot inherit authority. */
export async function resolveVerifiedGuestContact(db: Prisma.TransactionClient, contactSnapshotId: string) {
  const contact = await db.marketplaceCheckoutContactSnapshot.findUnique({ where: { id: contactSnapshotId }, include: { checkout: { select: { id: true, customerUserId: true, guestAccessTokenHash: true } }, guestEmailVerifications: { where: { verifiedAt: { not: null } } } } });
  if (!contact?.checkout || contact.checkout.customerUserId || !contact.checkout.guestAccessTokenHash || !contact.email || !contact.guestEmailVerifications.some((evidence) => evidence.checkoutId === contact.checkout!.id)) throw new NotificationPolicyError("RECIPIENT_NOT_RESOLVED");
  return { userId: guestContactSubjectKey(contact.id), roleProjection: "GUEST_CHECKOUT_CONTACT", verifiedEmail: true, email: contact.email };
}
