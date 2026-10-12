import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { assertMarketplaceLegalEvidence, resolveMarketplaceLegalEvidence } from "@/lib/marketplace-checkout/legal-evidence";
import { createPrismaMarketplaceAcknowledgementRepository } from "@/lib/marketplace-checkout/prisma-review-composition.repository";
const at = new Date("2026-10-07T08:00:00Z");
const content = "Disposable published policy content.";
const hash = createHash("sha256").update(content).digest("hex");
const evidence = { termsVersion: `TERMS_OF_SERVICE:${hash}`, privacyVersion: `PRIVACY_NOTICE:${hash}`, refundPolicyReferences: [`REFUND_POLICY:${hash}`] };
function database(overrides: Record<string, unknown> = {}) {
  return { legalDocumentVersion: { findFirst: vi.fn(async (args: { where: { documentType: string } }) => ({ publicReference: args.where.documentType, content, contentHash: hash, publishedAt: new Date("2026-01-01"), publishedByUserId: "disposable-publisher", ...overrides })) } };
}
describe("marketplace published legal authority", () => {
  it("binds references to effective South African published content and its immutable hash", async () => {
    const db = database();
    expect(await resolveMarketplaceLegalEvidence(db as unknown as Prisma.TransactionClient, at)).toEqual(evidence);
    expect(db.legalDocumentVersion.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { documentType: "TERMS_OF_SERVICE", jurisdiction: "ZA", publicationStatus: "PUBLISHED", effectiveAt: { lte: at } } }));
  });
  it.each([{ contentHash: "a".repeat(64) }, { content: null }, { publishedByUserId: null }, { publishedAt: new Date("2030-01-01") }])("rejects corrupt, absent or unreviewed publication evidence %#", async (override) => {
    await expect(resolveMarketplaceLegalEvidence(database(override) as unknown as Prisma.TransactionClient, at)).rejects.toMatchObject({ code: "CHECKOUT_LEGAL_BLOCKED" });
  });
  it("blocks missing published policies instead of inventing version references", async () => {
    const db = { legalDocumentVersion: { findFirst: vi.fn().mockResolvedValue(null) } };
    await expect(resolveMarketplaceLegalEvidence(db as unknown as Prisma.TransactionClient, at)).rejects.toMatchObject({ code: "CHECKOUT_LEGAL_BLOCKED" });
  });
  it.each([
    { ...evidence, termsVersion: "terms-2026-v1" },
    { ...evidence, privacyVersion: "privacy-2026-v1" },
    { ...evidence, refundPolicyReferences: ["refund-policy-v1"] },
    { ...evidence, refundPolicyReferences: [...evidence.refundPolicyReferences, "extra-policy"] },
  ])("rejects fabricated, superseded or additional policy evidence %#", (supplied) => {
    expect(() => assertMarketplaceLegalEvidence(supplied, evidence)).toThrow(expect.objectContaining({ code: "CHECKOUT_CHANGES_UNACKNOWLEDGED" }));
  });
  it("rechecks legal authority inside the canonical acknowledgement persistence path", async () => {
    const create = vi.fn();
    const db = { ...database(), marketplaceCheckoutAcknowledgement: { create }, marketplaceCheckoutChange: { updateMany: vi.fn() }, marketplaceCheckout: { update: vi.fn() }, marketplaceCheckoutOperation: { create: vi.fn() } };
    const repository = createPrismaMarketplaceAcknowledgementRepository(db);
    const input = { checkoutId: "checkout", checkoutVersion: 3, reviewVersion: 2, commercialFingerprint: "fingerprint", acknowledgedTotalReference: "1500.00", ...evidence, settlementEvidenceVersions: ["settlement"], changes: [], operationId: "acknowledgement-operation", requestHash: "hash" };
    await expect(repository.createAcknowledgement({ ...input, termsVersion: "forged" })).rejects.toMatchObject({ code: "CHECKOUT_CHANGES_UNACKNOWLEDGED" });
    expect(create).not.toHaveBeenCalled();
    await repository.createAcknowledgement(input);
    expect(create).toHaveBeenCalledWith({ data: expect.objectContaining({ termsVersion: evidence.termsVersion, privacyVersion: evidence.privacyVersion, refundPolicyReferences: evidence.refundPolicyReferences }) });
    expect(db.marketplaceCheckoutOperation.create).toHaveBeenCalledWith({ data: expect.objectContaining({ response: { acknowledged: true, reviewVersion: 2, checkoutVersion: 3 } }) });
  });
});
