import { beforeEach, describe, expect, it, vi } from "vitest";
const f = vi.hoisted(() => ({ media: vi.fn(), create: vi.fn(), audit: vi.fn() }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { $transaction: async (run: (tx: unknown) => unknown) => run({
  $queryRaw: async () => [], store: { findFirst: async () => ({ status: "ACTIVE" }) }, user: { findUnique: async () => ({ status: "ACTIVE" }) },
  systemSetting: { findUnique: async () => null, count: async () => 0, create: f.create },
  storeSellerLegalIdentity: { findFirst: async () => null }, privateMediaObject: { findFirst: f.media }, adminActivityLog: { create: f.audit },
}) } }));
import { submitStoreSellerIdentity } from "@/lib/services/store-seller-identity.service";
const input = { operationId: "evidence-test-operation", expectedIdentityReference: null, identityVersion: "v1", legalName: "Test seller", vatRegistrationStatus: "NOT_REGISTERED" as const, countryCode: "ZA" as const, invoiceClassification: "RECEIPT" as const, effectiveFrom: "2026-10-01T00:00:00.000Z", effectiveUntil: null, sourceEvidenceReference: "PMO-11111111-1111-4111-8111-111111111111", confirmSuppliedDetails: true as const };
describe("seller identity uploaded evidence association", () => {
  beforeEach(() => { vi.clearAllMocks(); f.media.mockResolvedValue({ id: "owned-evidence" }); f.create.mockImplementation(async ({ data }) => ({ ...data, updatedAt: new Date() })); f.audit.mockResolvedValue({}); });
  it("requires ready store verification evidence scoped to the canonical owner", async () => {
    expect((await submitStoreSellerIdentity("owned-store", "owner", input)).status).toBe("PENDING_REVIEW");
    expect(f.media).toHaveBeenCalledWith({ where: { publicReference: input.sourceEvidenceReference, ownerType: "STORE", ownerId: "owned-store", purpose: "STORE_VERIFICATION_DOCUMENT", status: "READY" }, select: { id: true } });
  });
  it("refuses foreign, deleted or wrong-purpose file references before saving a proposal", async () => {
    f.media.mockResolvedValue(null);
    await expect(submitStoreSellerIdentity("owned-store", "owner", input)).rejects.toMatchObject({ code: "SELLER_EVIDENCE_INVALID", status: 422 });
    expect(f.create).not.toHaveBeenCalled(); expect(f.audit).not.toHaveBeenCalled();
  });
  it("preserves established external evidence references", async () => {
    expect((await submitStoreSellerIdentity("owned-store", "owner", { ...input, sourceEvidenceReference: "EXISTING_REVIEWED_EVIDENCE" })).status).toBe("PENDING_REVIEW");
    expect(f.media).not.toHaveBeenCalled();
  });
});
