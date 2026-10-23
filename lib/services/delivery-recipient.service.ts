import type { Prisma } from "@prisma/client";
import { createHash } from "node:crypto";
import { prisma } from "@/lib/db/prisma";
import { NotificationPolicyError } from "@/lib/notifications/contracts";
import { resolveVerifiedGuestContact } from "@/lib/notifications/guest-recipient";

export type DeliveryOtpRecipient =
  | { kind: "ACCOUNT"; subjectUserId: string; email: string; name: string }
  | { kind: "SHIPMENT_RECIPIENT"; subjectUserId: string; email: string; name: string }
  | { kind: "GUEST_CHECKOUT_CONTACT"; subjectUserId: string; contactSnapshotId: string; email: string; name: string };

const unresolved = (): never => { throw new NotificationPolicyError("DELIVERY_RECIPIENT_NOT_RESOLVED"); };

/** Reconstruct the destination from the order and its canonical marketplace
 * bridge. A guest shipment must never inherit its selling store's email. */
export async function resolveDeliveryOtpRecipient(orderId: string, db: Prisma.TransactionClient = prisma): Promise<DeliveryOtpRecipient> {
  const order = await db.order.findUnique({ where: { id: orderId }, include: {
    customer: { select: { id: true, email: true, name: true, status: true, emailVerifiedAt: true } },
  } });
  if (!order || !["IN_TRANSIT", "DELIVERY_ATTEMPTED"].includes(order.status)) return unresolved();
  const bridge = await db.marketplaceStoreOrderDeliveryBridge.findUnique({ where: { courierOrderId: orderId }, include: {
    storeOrder: { include: { marketplaceOrder: { include: { checkout: { include: { contactSnapshot: true, addressSnapshot: true } } } } } },
  } });
  const snapshot = order.pricingSnapshot && typeof order.pricingSnapshot === "object" && !Array.isArray(order.pricingSnapshot) ? order.pricingSnapshot : {};
  const marketplaceReference = snapshot.marketplaceStoreOrderReference;
  if (bridge || marketplaceReference) {
    const storeOrder = bridge?.storeOrder;
    const marketplaceOrder = storeOrder?.marketplaceOrder;
    const checkout = marketplaceOrder?.checkout;
    if (!bridge || !storeOrder || !marketplaceOrder || !checkout ||
      marketplaceReference !== storeOrder.publicReference || order.storeId !== storeOrder.storeId ||
      order.customerId !== marketplaceOrder.customerUserId || marketplaceOrder.customerUserId !== checkout.customerUserId) return unresolved();
    if (!checkout.customerUserId) {
      if (!checkout.contactSnapshotId) return unresolved();
      try {
        const contact = await resolveVerifiedGuestContact(db, checkout.contactSnapshotId);
        return { kind: "GUEST_CHECKOUT_CONTACT", subjectUserId: contact.userId, contactSnapshotId: checkout.contactSnapshotId, email: contact.email, name: checkout.addressSnapshot?.recipientName ?? checkout.contactSnapshot?.recipientName ?? "Recipient" };
      } catch (error) {
        if (error instanceof NotificationPolicyError) return unresolved();
        throw error;
      }
    }
    const account = order.customer;
    if (!account?.email || account.status !== "ACTIVE" || !account.emailVerifiedAt) return unresolved();
    return { kind: "ACCOUNT", subjectUserId: account.id, email: account.email, name: checkout.addressSnapshot?.recipientName ?? checkout.contactSnapshot?.recipientName ?? "Recipient" };
  }
  const email = order.recipientEmail?.trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return unresolved();
  // This transactional shipment subject is not a platform account or marketing
  // consent. Possession is verified by presenting the code at the handoff. An
  // address edit changes its identity, so queued codes cannot be redirected.
  const addressHash = createHash("sha256").update(email).digest("hex").slice(0, 24);
  return { kind: "SHIPMENT_RECIPIENT", subjectUserId: `delivery-recipient:${order.id}:${addressHash}`, email, name: order.recipientName ?? "Recipient" };
}

/** Parcel sender identity is the verified booking account, never the receiver.
 * Marketplace has a separate store-authorized pickup challenge. */
export async function resolvePickupOtpSender(
  orderId: string,
  db: Prisma.TransactionClient = prisma,
): Promise<DeliveryOtpRecipient> {
  const order = await db.order.findUnique({
    where: { id: orderId },
    select: {
      id: true, status: true, customerId: true,
      customer: { select: { id: true, email: true, name: true, status: true, emailVerifiedAt: true } },
    },
  });
  if (!order || !["CONFIRMED", "PICKUP_SCHEDULED"].includes(order.status)) return unresolved();
  const bridge = await db.marketplaceStoreOrderDeliveryBridge.findUnique({
    where: { courierOrderId: orderId }, select: { id: true },
  });
  if (bridge) return unresolved();
  const account = order.customer;
  if (!account?.email || !order.customerId || order.customerId !== account.id ||
    account.status !== "ACTIVE" || !account.emailVerifiedAt) return unresolved();
  return { kind: "ACCOUNT", subjectUserId: account.id, email: account.email, name: account.name ?? "Sender" };
}
