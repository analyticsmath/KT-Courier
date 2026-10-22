import { describe, expect, it, vi } from "vitest";
import { requiredDomainDefinition } from "@/lib/notifications/required-domain-definitions";
import { resolveRequiredDomainPayload } from "@/lib/notifications/required-domain-payload";

const verifiedIntent = {
  sourceAuthority: "ACCOUNT",
  eventType: "ACCOUNT_EMAIL_VERIFIED",
  aggregateReference: "acct_123",
  operationId: "account-welcome:acct_123",
  safePayload: {},
};

describe("Verified-account welcome notifications", () => {
  it("registers an approved-review-only route to the verified account owner", () => {
    expect(requiredDomainDefinition("ACCOUNT", "ACCOUNT_EMAIL_VERIFIED")).toMatchObject({
      recipientPolicyKey: "CLIENT_VERIFIED_ACCOUNT",
      subject: "EVENT_ACTOR",
      actionRoute: "/account",
      templateKey: "CLIENT_ACCOUNT_WELCOME",
    });
  });

  it("reconstructs the recipient from active, verified account authority", async () => {
    const findUnique = vi.fn().mockResolvedValue({ id: "acct_123", status: "ACTIVE", emailVerifiedAt: new Date() });
    const db = { user: { findUnique } };
    await expect(resolveRequiredDomainPayload(db as never, verifiedIntent)).resolves.toEqual({ actorUserId: "acct_123" });
    expect(findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "acct_123" } }));
  });

  it("rejects unverified, suspended or forged welcome attempts", async () => {
    const findUnique = vi.fn().mockResolvedValue({ id: "acct_123", status: "ACTIVE", emailVerifiedAt: null });
    const db = { user: { findUnique } };
    await expect(resolveRequiredDomainPayload(db as never, verifiedIntent)).rejects.toMatchObject({ code: "CLIENT_NOTIFICATION_SOURCE_EVIDENCE_INVALID" });
    findUnique.mockResolvedValue({ id: "acct_123", status: "SUSPENDED", emailVerifiedAt: new Date() });
    await expect(resolveRequiredDomainPayload(db as never, verifiedIntent)).rejects.toMatchObject({ code: "CLIENT_NOTIFICATION_SOURCE_EVIDENCE_INVALID" });
    await expect(resolveRequiredDomainPayload(db as never, { ...verifiedIntent, operationId: "account-welcome:someone-else" })).rejects.toMatchObject({ code: "CLIENT_NOTIFICATION_SOURCE_EVIDENCE_INVALID" });
  });
});
