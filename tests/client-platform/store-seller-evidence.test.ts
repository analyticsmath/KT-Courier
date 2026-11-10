import { beforeEach, describe, expect, it, vi } from "vitest";
import { catalogRequestHash } from "@/lib/catalog/catalog-normalization";

const f = vi.hoisted(() => ({
  media: vi.fn(),
  create: vi.fn(),
  audit: vi.fn(),
  findSettingUnique: vi.fn(),
  findSettingFirst: vi.fn(),
  findIdentityFirst: vi.fn(),
  findUserUnique: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    $transaction: async (run: (tx: unknown) => unknown) =>
      run({
        $queryRaw: async () => [],
        store: { findFirst: async () => ({ status: "ACTIVE" }) },
        user: { findUnique: f.findUserUnique },
        systemSetting: {
          findUnique: f.findSettingUnique,
          findFirst: f.findSettingFirst,
          count: async () => 0,
          create: f.create,
        },
        storeSellerLegalIdentity: { findFirst: f.findIdentityFirst },
        privateMediaObject: { findFirst: f.media },
        adminActivityLog: { create: f.audit },
      }),
  },
}));

import { submitStoreSellerIdentity } from "@/lib/services/store-seller-identity.service";

const input = {
  operationId: "evidence-test-operation",
  expectedIdentityReference: null,
  identityVersion: "v1",
  legalName: "Test seller",
  vatRegistrationStatus: "NOT_REGISTERED" as const,
  countryCode: "ZA" as const,
  invoiceClassification: "RECEIPT" as const,
  effectiveFrom: "2026-10-01T00:00:00.000Z",
  effectiveUntil: null,
  sourceEvidenceReference: "PMO-11111111-1111-4111-8111-111111111111",
  confirmSuppliedDetails: true as const,
};

describe("seller identity uploaded evidence association", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    f.media.mockResolvedValue({ id: "owned-evidence" });
    f.create.mockImplementation(async ({ data }) => ({ ...data, updatedAt: new Date() }));
    f.audit.mockResolvedValue({});
    f.findSettingUnique.mockResolvedValue(null);
    f.findSettingFirst.mockResolvedValue(null);
    f.findIdentityFirst.mockResolvedValue(null);
    f.findUserUnique.mockImplementation(async ({ where }: { where: { id: string } }) =>
      where.id === "checker"
        ? { role: "SUPER_ADMIN", status: "ACTIVE" }
        : { role: "STORE", status: "ACTIVE" },
    );
  });

  it("requires ready store verification evidence scoped to the canonical owner", async () => {
    expect((await submitStoreSellerIdentity("owned-store", "owner", input)).status).toBe("PENDING_REVIEW");
    expect(f.media).toHaveBeenCalledWith({
      where: {
        publicReference: input.sourceEvidenceReference,
        ownerType: "STORE",
        ownerId: "owned-store",
        purpose: "STORE_VERIFICATION_DOCUMENT",
        status: "READY",
      },
      select: { id: true },
    });
  });

  it("refuses foreign, deleted or wrong-purpose file references before saving a proposal", async () => {
    f.media.mockResolvedValue(null);
    await expect(submitStoreSellerIdentity("owned-store", "owner", input)).rejects.toMatchObject({
      code: "SELLER_EVIDENCE_INVALID",
      status: 422,
    });
    expect(f.create).not.toHaveBeenCalled();
    expect(f.audit).not.toHaveBeenCalled();
  });

  it("rejects EXISTING_REVIEWED_EVIDENCE for new applicants or stores without prior reviewed evidence", async () => {
    await expect(
      submitStoreSellerIdentity("owned-store", "owner", {
        ...input,
        sourceEvidenceReference: "EXISTING_REVIEWED_EVIDENCE",
      }),
    ).rejects.toMatchObject({
      code: "SELLER_EVIDENCE_INVALID",
      status: 422,
    });
    expect(f.media).not.toHaveBeenCalled();
    expect(f.create).not.toHaveBeenCalled();

    await expect(
      submitStoreSellerIdentity("owned-store", "owner", {
        ...input,
        expectedIdentityReference: "SID-11111111111111111111111111111111",
        sourceEvidenceReference: "EXISTING_REVIEWED_EVIDENCE",
      }),
    ).rejects.toMatchObject({
      code: "SELLER_EVIDENCE_INVALID",
      status: 422,
    });
    expect(f.create).not.toHaveBeenCalled();
  });

  it("allows EXISTING_REVIEWED_EVIDENCE only when bound to an existing approved identity and valid prior store evidence", async () => {
    const existingRef = "SID-11111111111111111111111111111111";
    f.findIdentityFirst.mockImplementation(async ({ where }: { where: Record<string, unknown> }) => {
      if ("identityVersion" in where) return null;
      return {
        id: "identity-1",
        publicReference: existingRef,
        effectiveFrom: new Date("2026-09-01T00:00:00.000Z"),
      };
    });
    const priorInput = {
      ...input,
      identityVersion: "v0",
      sourceEvidenceReference: "PMO-11111111-1111-4111-8111-111111111111",
    };
    f.findSettingFirst.mockResolvedValue({
      value: {
        schemaVersion: 1,
        reference: "SLP-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
        storeId: "owned-store",
        makerUserId: "owner",
        requestHash: catalogRequestHash(priorInput),
        input: priorInput,
        status: "APPROVED",
        identityReference: existingRef,
      },
    });
    const result = await submitStoreSellerIdentity("owned-store", "owner", {
      ...input,
      identityVersion: "v2",
      expectedIdentityReference: existingRef,
      sourceEvidenceReference: "EXISTING_REVIEWED_EVIDENCE",
    });
    expect(result.status).toBe("PENDING_REVIEW");
    expect(f.media).toHaveBeenCalledWith({
      where: {
        publicReference: priorInput.sourceEvidenceReference,
        ownerType: "STORE",
        ownerId: "owned-store",
        purpose: "STORE_VERIFICATION_DOCUMENT",
        status: "READY",
      },
      select: { id: true },
    });
  });

  it("validates EXT- references against store ownership, reviewed status, and independent admin authority", async () => {
    const extRef = "EXT-VERIFIED_DOC_2026";
    f.findSettingUnique.mockImplementation(async ({ where }: { where: { key: string } }) => {
      if (where.key === `store_seller_external_evidence:owned-store:${extRef}`) {
        return {
          value: {
            schemaVersion: 1,
            reference: extRef,
            storeId: "owned-store",
            status: "REVIEWED",
            authorizedByUserId: "checker",
            documentDigest: "sha256:0123456789abcdef0123456789abcdef",
          },
        };
      }
      return null;
    });
    expect(
      (
        await submitStoreSellerIdentity("owned-store", "owner", {
          ...input,
          sourceEvidenceReference: extRef,
        })
      ).status,
    ).toBe("PENDING_REVIEW");

    // Swapped storeId in external receipt payload must be rejected
    f.findSettingUnique.mockImplementation(async ({ where }: { where: { key: string } }) => {
      if (where.key === `store_seller_external_evidence:owned-store:${extRef}`) {
        return {
          value: {
            schemaVersion: 1,
            reference: extRef,
            storeId: "other-store",
            status: "REVIEWED",
            authorizedByUserId: "checker",
            documentDigest: "sha256:0123456789abcdef0123456789abcdef",
          },
        };
      }
      return null;
    });
    await expect(
      submitStoreSellerIdentity("owned-store", "owner", {
        ...input,
        sourceEvidenceReference: extRef,
      }),
    ).rejects.toMatchObject({ code: "SELLER_EVIDENCE_INVALID", status: 422 });
  });

  it("rejects free-form shop names and SYNTHETIC_* tokens with 422 before any database write", async () => {
    for (const invalidRef of [
      "PammyBakes",
      "SYNTHETIC_OWNER_INPUT",
      "SYNTHETIC_OWNER_DETAILS_NOT_REAL_APPROVAL",
    ]) {
      await expect(
        submitStoreSellerIdentity("owned-store", "owner", {
          ...input,
          sourceEvidenceReference: invalidRef,
        }),
      ).rejects.toMatchObject({
        code: "SELLER_EVIDENCE_INVALID",
        status: 422,
        message: "Upload your verification document first, then use the automatically generated reference.",
      });
    }
    expect(f.media).not.toHaveBeenCalled();
    expect(f.create).not.toHaveBeenCalled();
    expect(f.audit).not.toHaveBeenCalled();
  });
});
