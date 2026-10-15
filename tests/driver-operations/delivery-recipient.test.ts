import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Prisma } from "@prisma/client";
import { resolveDeliveryOtpRecipient } from "@/lib/services/delivery-recipient.service";

describe("delivery OTP recipient authority", () => {
  const findOrder = vi.fn(), findBridge = vi.fn(), findContact = vi.fn();
  const db = { order: { findUnique: findOrder }, marketplaceStoreOrderDeliveryBridge: { findUnique: findBridge }, marketplaceCheckoutContactSnapshot: { findUnique: findContact } } as unknown as Prisma.TransactionClient;
  const account = { id: "seller", email: "seller@example.test", name: "Seller", status: "ACTIVE", emailVerifiedAt: new Date() };
  const order = { id: "courier", status: "IN_TRANSIT", orderNumber: "KT-1", source: "STORE", customerId: null, storeId: "store", pricingSnapshot: { marketplaceStoreOrderReference: "MSO-1" }, customer: null, store: { ownerUser: account } };
  const checkout = { id: "checkout", customerUserId: null, contactSnapshotId: "contact", contactSnapshot: { recipientName: "Guest recipient" }, addressSnapshot: { recipientName: "Destination recipient" } };
  const bridge = { courierOrderId: "courier", storeOrder: { publicReference: "MSO-1", storeId: "store", marketplaceOrder: { customerUserId: null, checkout } } };
  beforeEach(() => {
    findOrder.mockResolvedValue(order); findBridge.mockResolvedValue(bridge);
    findContact.mockResolvedValue({ id: "contact", email: "guest@example.test", checkout: { id: "checkout", customerUserId: null, guestAccessTokenHash: "hash" }, guestEmailVerifications: [{ checkoutId: "checkout", verifiedAt: new Date() }] });
  });
  it("uses the verified guest checkout contact and destination name, never the seller", async () => {
    await expect(resolveDeliveryOtpRecipient("courier", db)).resolves.toEqual({ kind: "GUEST_CHECKOUT_CONTACT", subjectUserId: "guest-checkout-contact:contact", contactSnapshotId: "contact", email: "guest@example.test", name: "Destination recipient" });
  });
  it.each(["unverified", "claimed", "replaced"])("rejects %s guest contact authority without seller fallback", async (reason) => {
    findContact.mockResolvedValue({ id: "contact", email: "guest@example.test", checkout: reason === "replaced" ? null : { id: "checkout", customerUserId: reason === "claimed" ? "new-owner" : null, guestAccessTokenHash: "hash" }, guestEmailVerifications: reason === "unverified" ? [] : [{ checkoutId: "checkout", verifiedAt: new Date() }] });
    await expect(resolveDeliveryOtpRecipient("courier", db)).rejects.toMatchObject({ code: "DELIVERY_RECIPIENT_NOT_RESOLVED" });
  });
  it("rejects a snapshot that points at a different store order", async () => {
    findBridge.mockResolvedValue({ ...bridge, storeOrder: { ...bridge.storeOrder, publicReference: "MSO-OTHER" } });
    await expect(resolveDeliveryOtpRecipient("courier", db)).rejects.toMatchObject({ code: "DELIVERY_RECIPIENT_NOT_RESOLVED" });
    expect(findContact).not.toHaveBeenCalled();
  });
  it("rejects an orphaned marketplace snapshot instead of falling back to the seller", async () => {
    findBridge.mockResolvedValue(null);
    await expect(resolveDeliveryOtpRecipient("courier", db)).rejects.toMatchObject({ code: "DELIVERY_RECIPIENT_NOT_RESOLVED" });
  });
  it("uses the explicit parcel recipient even when the sender has a different verified account", async () => {
    findOrder.mockResolvedValue({ ...order, source: "CUSTOMER", customerId: "buyer", recipientName: "Receiver", recipientEmail: " Receiver@Example.Test ", pricingSnapshot: {}, customer: { ...account, id: "buyer", email: "buyer@example.test" } }); findBridge.mockResolvedValue(null);
    await expect(resolveDeliveryOtpRecipient("courier", db)).resolves.toMatchObject({ kind: "SHIPMENT_RECIPIENT", subjectUserId: expect.stringMatching(/^delivery-recipient:courier:[a-f0-9]{24}$/), email: "receiver@example.test", name: "Receiver" });
  });
  it("does not send a legacy parcel's handoff code to its sender when recipient email is absent", async () => {
    findOrder.mockResolvedValue({ ...order, source: "CUSTOMER", customerId: "buyer", pricingSnapshot: {}, customer: { ...account, id: "buyer" } }); findBridge.mockResolvedValue(null);
    await expect(resolveDeliveryOtpRecipient("courier", db)).rejects.toMatchObject({ code: "DELIVERY_RECIPIENT_NOT_RESOLVED" });
  });
  it("changes the delivery subject when the parcel recipient email changes", async () => {
    findBridge.mockResolvedValue(null);
    findOrder.mockResolvedValue({ ...order, pricingSnapshot: {}, recipientEmail: "first@example.test" });
    const first = await resolveDeliveryOtpRecipient("courier", db);
    findOrder.mockResolvedValue({ ...order, pricingSnapshot: {}, recipientEmail: "second@example.test" });
    expect((await resolveDeliveryOtpRecipient("courier", db)).subjectUserId).not.toBe(first.subjectUserId);
  });
  it.each(["CANCELLED", "DELIVERED", "COMPLETED", "FAILED"])("revokes OTP recipient authority when an order is %s", async (status) => {
    findOrder.mockResolvedValue({ ...order, status });
    await expect(resolveDeliveryOtpRecipient("courier", db)).rejects.toMatchObject({ code: "DELIVERY_RECIPIENT_NOT_RESOLVED" });
  });
  it("rejects inconsistent marketplace customer ownership", async () => {
    findBridge.mockResolvedValue({ ...bridge, storeOrder: { ...bridge.storeOrder, marketplaceOrder: { customerUserId: "buyer", checkout } } });
    await expect(resolveDeliveryOtpRecipient("courier", db)).rejects.toMatchObject({ code: "DELIVERY_RECIPIENT_NOT_RESOLVED" });
  });
});
