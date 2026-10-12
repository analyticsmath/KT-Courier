import type { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { guestContactSubjectKey, resolveVerifiedGuestContact } from "@/lib/notifications/guest-recipient";

describe("contact-scoped guest notification recipient", () => {
  const contact = { id: "contact", email: "guest@example.test", checkout: { id: "checkout", customerUserId: null, guestAccessTokenHash: "guest-hash" }, guestEmailVerifications: [{ checkoutId: "checkout", verifiedAt: new Date() }] };
  const db = (value: unknown) => ({ marketplaceCheckoutContactSnapshot: { findUnique: vi.fn().mockResolvedValue(value) } }) as unknown as Prisma.TransactionClient;
  it("resolves a verified current guest without creating or impersonating a user", async () => {
    expect(await resolveVerifiedGuestContact(db(contact), "contact")).toEqual({ userId: guestContactSubjectKey("contact"), roleProjection: "GUEST_CHECKOUT_CONTACT", verifiedEmail: true, email: "guest@example.test" });
  });
  it.each([
    { ...contact, checkout: null },
    { ...contact, checkout: { ...contact.checkout, customerUserId: "claimed-account" } },
    { ...contact, checkout: { ...contact.checkout, guestAccessTokenHash: null } },
    { ...contact, guestEmailVerifications: [] },
    { ...contact, guestEmailVerifications: [{ checkoutId: "other-checkout" }] },
  ])("denies stale, claimed, unverified or foreign-contact evidence %#", async (value) => {
    await expect(resolveVerifiedGuestContact(db(value), "contact")).rejects.toMatchObject({ code: "RECIPIENT_NOT_RESOLVED" });
  });
});
