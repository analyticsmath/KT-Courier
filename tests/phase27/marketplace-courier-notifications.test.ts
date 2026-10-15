import { describe, expect, it, vi } from "vitest";
import { createNotificationMemoryDb } from "./helpers/in-memory-notification-db";
import { prepareRequiredDomainNotifications, reviewRequiredDomainNotification } from "@/lib/notifications/required-domain-configuration";
import { publishCustomerOrderIntent } from "@/lib/notifications/customer-order-publication";
import { currentRequiredSourceRecipient } from "@/lib/notifications/current-source-recipient";
import { appendOrderStatusChangedInTx } from "@/lib/services/notification-events.service";

describe("marketplace courier execution notifications", () => {
  async function fixture(guest: boolean, eventType = "COURIER_DELIVERED") {
    const db = createNotificationMemoryDb({ user: [{ id: "buyer", role: "CUSTOMER", email: "buyer@example.test", status: "ACTIVE", emailVerifiedAt: new Date() }] });
    // The notification test adapter does not implement Prisma's nullable `not`
    // filter; supply the first activation from the same stored route versions.
    const findVersion = db.notificationEventRouteVersion.findFirst;
    db.notificationEventRouteVersion.findFirst = async (args: { where: { routeId: string; activatedAt?: { not: null } } }) => args.where.activatedAt
      ? db.__state.notificationEventRouteVersion.find((row: { routeId: string; activatedAt?: Date }) => row.routeId === args.where.routeId && row.activatedAt)
      : findVersion(args);
    const checkout = { id: "checkout", customerUserId: guest ? null : "buyer", publicReference: "CHECKOUT-1", contactSnapshotId: "contact" };
    db.marketplaceCheckout = { findUnique: vi.fn(async () => checkout) };
    db.marketplaceCheckoutContactSnapshot = { findUnique: vi.fn(async () => ({ id: "contact", email: "guest@example.test", checkout: { ...checkout, guestAccessTokenHash: "hash" }, guestEmailVerifications: [{ checkoutId: "checkout", verifiedAt: new Date() }] })) };
    db.marketplaceStoreOrder = { findUnique: vi.fn(async () => ({ id: "store-order", publicReference: "MSO-1", store: { ownerUserId: "seller", status: "ACTIVE" }, marketplaceOrder: { customerUserId: checkout.customerUserId, checkout } })) };
    db.marketplaceStoreOrderEventIntent = { findUnique: vi.fn(async () => ({ id: "execution", marketplaceStoreOrderId: "store-order", eventType })) };
    await prepareRequiredDomainNotifications(db);
    for (const action of ["APPROVE_RECIPIENT_POLICY", "APPROVE_TEMPLATE", "PUBLISH_TEMPLATE", "PREPARE_ROUTE", "APPROVE_ROUTE", "ACTIVATE_ROUTE"] as const) {
      await reviewRequiredDomainNotification(db, eventType, action, ["PUBLISH_TEMPLATE", "ACTIVATE_ROUTE"].includes(action) ? "publisher" : "reviewer");
    }
    await db.notificationEventIntent.create({ data: { id: "intent", sourceAuthority: "STORE_ORDERS", eventType, aggregateReference: "store-order", operationId: "store-order-notification:execution", safePayload: { sourceEventId: "execution", customerUserId: "seller", email: "seller@example.test" } } });
    return { db, checkout };
  }
  it.each(["COURIER_DRIVER_ASSIGNED", "COURIER_PICKED_UP", "COURIER_IN_TRANSIT", "COURIER_DELIVERY_ATTEMPTED", "COURIER_DELIVERED", "COURIER_FAILED"])("publishes %s to the verified guest once, with no account inbox or seller delivery", async (eventType) => {
    const { db } = await fixture(true, eventType);
    expect(await publishCustomerOrderIntent(db, "intent")).toBe("PUBLISHED");
    expect(await publishCustomerOrderIntent(db, "intent")).toBe("SKIPPED");
    expect(db.__state.notificationMessage).toHaveLength(1);
    expect(db.__state.notificationDelivery).toEqual(expect.arrayContaining([expect.objectContaining({ recipientUserId: "guest-checkout-contact:contact", channel: "EMAIL", status: "QUEUED" })]));
    expect(db.__state.notificationDelivery.every((row: { recipientUserId: string }) => row.recipientUserId !== "seller")).toBe(true);
    expect(db.__state.notificationInboxItem).toHaveLength(0);
  });
  it("publishes one account inbox and email tied to the marketplace store order", async () => {
    const { db } = await fixture(false);
    await publishCustomerOrderIntent(db, "intent"); await publishCustomerOrderIntent(db, "intent");
    expect(db.__state.notificationInboxItem).toEqual([expect.objectContaining({ ownerUserId: "buyer", body: expect.stringContaining("MSO-1"), actionRoute: null })]);
    expect(db.__state.notificationDelivery.filter((row: { channel: string }) => row.channel === "EMAIL")).toEqual([expect.objectContaining({ recipientUserId: "buyer", status: "QUEUED" })]);
  });
  it("rechecks checkout ownership before sending a queued guest message", async () => {
    const { db, checkout } = await fixture(true);
    await publishCustomerOrderIntent(db, "intent");
    const receiptId = db.__state.notificationMessage[0].sourceReceiptId;
    expect(await currentRequiredSourceRecipient(db, receiptId, "guest-checkout-contact:contact")).toBe(true);
    checkout.customerUserId = "buyer";
    expect(await currentRequiredSourceRecipient(db, receiptId, "guest-checkout-contact:contact")).toBe(false);
  });
  it("suppresses the duplicate legacy courier event only for marketplace orders", async () => {
    const upsert = vi.fn();
    const db = { notificationEventIntent: { upsert } } as unknown as Parameters<typeof appendOrderStatusChangedInTx>[0];
    const order = { id: "courier", orderNumber: "KT-1", source: "STORE", status: "DELIVERED" };
    await appendOrderStatusChangedInTx(db, { ...order, pricingSnapshot: { marketplaceStoreOrderReference: "MSO-1" } }, "history");
    expect(upsert).not.toHaveBeenCalled();
    await appendOrderStatusChangedInTx(db, order, "history");
    expect(upsert).toHaveBeenCalledOnce();
  });
});
