import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { getMarketplaceCheckoutForOwner, projectPublicCheckout, updateMarketplaceCheckoutContact } from "@/lib/marketplace-checkout/checkout.service";

describe("owner-only checkout resumption on disposable PostgreSQL", () => {
  const prefix = `checkout-resume-${randomUUID()}`;
  const users: string[] = []; const carts: string[] = []; const checkouts: string[] = [];
  const contacts: string[] = []; const addresses: string[] = [];
  let safe = false;
  const references = [`${prefix}-customer`, `${prefix}-guest`];
  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL ?? "postgres://localhost/absent");
    if (process.env.NODE_ENV === "production" || process.env.KT_ALLOW_ISOLATED_POSTGRES_TESTS !== "1" || url.pathname !== "/kt_launch_test" || !["localhost", "127.0.0.1"].includes(url.hostname)) throw new Error("Disposable closure database required.");
    safe = true;
    for (const suffix of ["owner", "foreign"]) users.push((await prisma.user.create({ data: { email: `${prefix}-${suffix}@example.test`, role: "CUSTOMER", status: "ACTIVE" } })).id);
    for (const [index, ownerType] of (["CUSTOMER", "GUEST"] as const).entries()) {
      const owner = ownerType === "CUSTOMER" ? { customerUserId: users[0] } : { guestTokenHash: `${prefix}-guest-token` };
      const cart = await prisma.marketplaceCart.create({ data: { publicReference: `${prefix}-cart-${index}`, ownerType, ...owner } }); carts.push(cart.id);
      const contact = await prisma.marketplaceCheckoutContactSnapshot.create({ data: { recipientName: `${prefix} Recipient`, email: `${prefix}@example.test`, phone: "+27821112233", preferredContactMethod: "EMAIL", verifiedCustomerReference: "private-verification" } }); contacts.push(contact.id);
      const address = await prisma.marketplaceCheckoutAddressSnapshot.create({ data: { recipientName: contact.recipientName, line1: "45 Commission St", line2: "Unit 2", suburb: "Central", city: "Johannesburg", province: "Gauteng", postalCode: "2001", deliveryInstructions: "Reception", serviceAreaReference: "private-region", protectedCoordinates: { latitude: -26.2, longitude: 28.0 }, serviceabilityEvidence: { privateBoundary: true } } }); addresses.push(address.id);
      const checkout = await prisma.marketplaceCheckout.create({ data: { publicReference: references[index], cartId: cart.id, ...(ownerType === "CUSTOMER" ? { customerUserId: users[0] } : { guestAccessTokenHash: `${prefix}-guest-token` }), contactSnapshotId: contact.id, addressSnapshotId: address.id, status: "VALIDATING" } }); checkouts.push(checkout.id);
    }
  });
  afterAll(async () => {
    if (!safe) return;
    await prisma.marketplaceCheckout.deleteMany({ where: { id: { in: checkouts } } });
    await prisma.marketplaceCheckoutContactSnapshot.deleteMany({ where: { id: { in: contacts } } });
    await prisma.marketplaceCheckoutAddressSnapshot.deleteMany({ where: { id: { in: addresses } } });
    await prisma.marketplaceCart.deleteMany({ where: { id: { in: carts } } });
    await prisma.user.deleteMany({ where: { id: { in: users } } });
  });
  for (const [index, type] of (["CUSTOMER", "GUEST"] as const).entries()) {
    it(`resumes ${type.toLowerCase()} contact and address without private verification/coverage evidence`, async () => {
      const owner = type === "CUSTOMER" ? { type, userId: users[0] } : { type, guestTokenHash: `${prefix}-guest-token` };
      const result = projectPublicCheckout(await getMarketplaceCheckoutForOwner(references[index], owner));
      expect(result).toMatchObject({ reference: references[index], contact: { recipientName: `${prefix} Recipient`, phone: "+27821112233" }, deliveryAddress: { line1: "45 Commission St", line2: "Unit 2", deliveryInstructions: "Reception" } });
      expect(Object.keys(result!.contact!).sort()).toEqual(["recipientName", "email", "phone", "preferredContactMethod"].sort());
      expect(Object.keys(result!.deliveryAddress!).sort()).toEqual(["recipientName", "line1", "line2", "suburb", "city", "province", "postalCode", "country", "deliveryInstructions"].sort());
      expect(JSON.stringify(result)).not.toContain("private-");
    });
  }
  it("denies foreign customers, guessed guest secrets and cross-owner-type references", async () => {
    for (const reference of references) {
      await expect(getMarketplaceCheckoutForOwner(reference, { type: "CUSTOMER", userId: users[1] })).rejects.toMatchObject({ code: "CHECKOUT_ACCESS_DENIED" });
      await expect(getMarketplaceCheckoutForOwner(reference, { type: "GUEST", guestTokenHash: "foreign-secret" })).rejects.toMatchObject({ code: "CHECKOUT_ACCESS_DENIED" });
    }
    await expect(getMarketplaceCheckoutForOwner(references[0], { type: "GUEST", guestTokenHash: `${prefix}-guest-token` })).rejects.toMatchObject({ code: "CHECKOUT_ACCESS_DENIED" });
    await expect(getMarketplaceCheckoutForOwner(references[1], { type: "CUSTOMER", userId: users[0] })).rejects.toMatchObject({ code: "CHECKOUT_ACCESS_DENIED" });
  });
  it("rejected contact correction leaves the stored snapshot and checkout version unchanged", async () => {
    const before = await prisma.marketplaceCheckout.findUniqueOrThrow({ where: { id: checkouts[0] } });
    await expect(updateMarketplaceCheckoutContact({ reference: references[0], owner: { type: "CUSTOMER", userId: users[0] }, operation: { operationId: `${prefix}-invalid`, requestHash: "a".repeat(64), expectedVersion: before.version }, contact: { recipientName: "Recipient", email: `${prefix}@example.test`, phone: "123" } })).rejects.toMatchObject({ code: "CHECKOUT_REVIEW_REQUIRED" });
    expect(await prisma.marketplaceCheckout.findUniqueOrThrow({ where: { id: checkouts[0] } })).toEqual(before);
  });
  it("contact correction resumes the latest immutable snapshot and retains the historical one", async () => {
    const before = await prisma.marketplaceCheckout.findUniqueOrThrow({ where: { id: checkouts[0] } });
    const historical = await prisma.marketplaceCheckoutContactSnapshot.findUniqueOrThrow({ where: { id: before.contactSnapshotId! } });
    await updateMarketplaceCheckoutContact({ reference: references[0], owner: { type: "CUSTOMER", userId: users[0] }, operation: { operationId: `${prefix}-correct`, requestHash: "b".repeat(64), expectedVersion: before.version }, contact: { recipientName: "Corrected recipient", email: `${prefix}-corrected@example.test`, phone: "+27821112233", preferredContactMethod: "EMAIL" } });
    const after = await prisma.marketplaceCheckout.findUniqueOrThrow({ where: { id: checkouts[0] } }); contacts.push(after.contactSnapshotId!);
    expect(after.version).toBe(before.version + 1); expect(after.contactSnapshotId).not.toBe(before.contactSnapshotId);
    expect(await prisma.marketplaceCheckoutContactSnapshot.findUniqueOrThrow({ where: { id: before.contactSnapshotId! } })).toEqual(historical);
    expect(projectPublicCheckout(await getMarketplaceCheckoutForOwner(references[0], { type: "CUSTOMER", userId: users[0] }))!.contact!.recipientName).toBe("Corrected recipient");
  });
});
