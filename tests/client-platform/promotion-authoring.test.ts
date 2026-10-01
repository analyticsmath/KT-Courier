import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { Prisma } from "@prisma/client";
const db = vi.hoisted(() => ({
  $transaction: vi.fn(),
  $executeRaw: vi.fn(),
  $queryRaw: vi.fn(),
  promotionCampaign: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    findUniqueOrThrow: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  promotionCampaignVersion: {
    findUniqueOrThrow: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  promotionCampaignVersionTarget: { deleteMany: vi.fn() },
  promotionCode: { deleteMany: vi.fn() },
  promotionStatusHistory: { create: vi.fn() },
  storeCatalogOffer: { findMany: vi.fn() },
  adminActivityLog: { create: vi.fn(), findFirst: vi.fn() },
}));
const access = vi.hoisted(() => vi.fn());
const permitted = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/permissions", () => ({ hasPermission: permitted }));
import type { AuthenticatedUser } from "@/types/domain";
vi.mock("@/lib/db/prisma", () => ({ prisma: db }));
vi.mock("@/lib/client-platform/store-access", () => ({ storeAccess: access }));
import {
  PromotionDraftSchema,
  createBusinessPromotion,
  getBusinessPromotion,
  submitBusinessPromotion,
  updateBusinessPromotion,
  reviewBusinessPromotion,
} from "@/lib/client-platform/promotion-authoring.service";
const draft = {
  requestId: "d2643439-2bb1-4b73-aa49-932b714b6978",
  name: "New customer offer",
  description: "Save on our business catalog.",
  mechanism: "PERCENTAGE",
  value: "12.34",
  proposedBudget: "1000.00",
  startsAt: "2026-11-01T00:00:00Z",
  endsAt: "2026-11-30T00:00:00Z",
  globalLimit: 100,
  perCustomerLimit: 1,
};
function campaign() {
  return {
    id: "campaign",
    publicReference: "PROMO_public",
    name: draft.name,
    versions: [
      {
        id: "version",
        status: "DRAFT",
        clientDraftRevision: 0,
        discountMechanism: "PERCENTAGE",
        percentageValue: new Prisma.Decimal(1234),
        fixedAmount: null,
        maximumDiscountAmount: null,
        minimumEligibleSubtotal: null,
        proposedBudgetAmount: new Prisma.Decimal(1000),
        startsAt: new Date(draft.startsAt),
        endsAt: new Date(draft.endsAt),
        maximumRedemptionsGlobal: 100,
        maximumRedemptionsPerCustomer: 1,
        promotionDescription: draft.description,
        targets: [],
        codes: [],
        budget: null,
        _count: { redemptions: 0 },
      },
    ],
  };
}
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-01T00:00:00Z"));
  vi.resetAllMocks();
  permitted.mockResolvedValue(true);
  access.mockResolvedValue({ store: { id: "actual-store", status: "ACTIVE" } });
  db.$transaction.mockImplementation((fn) => fn(db));
  db.storeCatalogOffer.findMany.mockResolvedValue([]);
  db.promotionCampaign.create.mockResolvedValue(campaign());
  db.promotionCampaign.findFirst.mockResolvedValue(campaign());
  db.promotionCampaign.findUniqueOrThrow.mockResolvedValue(campaign());
  db.promotionCampaignVersion.updateMany.mockResolvedValue({ count: 1 });
  db.promotionCampaignVersion.findUniqueOrThrow.mockResolvedValue(
    campaign().versions[0],
  );
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});
describe("business promotion authoring", () => {
  it("rejects injected business identity and invalid percentages, dates or limits", () => {
    expect(
      PromotionDraftSchema.safeParse({ ...draft, storeId: "other" }).success,
    ).toBe(false);
    expect(
      PromotionDraftSchema.safeParse({ ...draft, value: "100.01" }).success,
    ).toBe(false);
    expect(
      PromotionDraftSchema.safeParse({ ...draft, endsAt: draft.startsAt })
        .success,
    ).toBe(false);
    expect(
      PromotionDraftSchema.safeParse({ ...draft, perCustomerLimit: 101 })
        .success,
    ).toBe(false);
  });
  it("writes exact basis points, proposed budget and actual actor without activating or funding", async () => {
    await createBusinessPromotion("employee", draft);
    expect(access).toHaveBeenCalledWith("employee", "marketing");
    const data = db.promotionCampaign.create.mock.calls[0][0].data;
    expect(data.ownerStoreId).toBe("actual-store");
    expect(data.versions.create.percentageValue.toString()).toBe("1234");
    expect(data.versions.create.proposedBudgetAmount.toFixed(2)).toBe(
      "1000.00",
    );
    expect(data.versions.create).not.toHaveProperty("budget");
    expect(data.versions.create.statusHistory.create.actorUserId).toBe(
      "employee",
    );
    expect(db.adminActivityLog.create.mock.calls[0][0].data.actorUserId).toBe(
      "employee",
    );
  });
  it("does not accept products outside the actual business", async () => {
    await expect(
      createBusinessPromotion("employee", {
        ...draft,
        productIds: ["cm000000000000000000000001"],
      }),
    ).rejects.toMatchObject({ code: "PROMOTION_TARGET_SCOPE" });
    expect(db.promotionCampaign.create).not.toHaveBeenCalled();
  });
  it("stores only keyed coupon evidence, never plaintext", async () => {
    vi.stubEnv("PROMOTION_CODE_HMAC_KEY", "k".repeat(64));
    await createBusinessPromotion("employee", {
      ...draft,
      coupon: "WELCOME123",
    });
    const data = db.promotionCampaign.create.mock.calls[0][0].data;
    expect(data.versions.create.codes.create.codeHmac).toMatch(
      /^[a-f0-9]{64}$/,
    );
    expect(JSON.stringify(data)).not.toContain("WELCOME123");
    expect(JSON.stringify(db.adminActivityLog.create.mock.calls)).not.toContain(
      "WELCOME123",
    );
  });
  it("refuses coupons when their key is unconfigured", async () => {
    vi.stubEnv("PROMOTION_CODE_HMAC_KEY", "");
    await expect(
      createBusinessPromotion("employee", { ...draft, coupon: "WELCOME123" }),
    ).rejects.toMatchObject({ code: "COUPON_CONFIGURATION" });
    expect(db.promotionCampaign.create).not.toHaveBeenCalled();
  });
  it("rejects replaying a request with different details", async () => {
    db.promotionCampaign.findUnique.mockResolvedValue(campaign());
    db.adminActivityLog.findFirst.mockResolvedValue(null);
    await expect(
      createBusinessPromotion("employee", draft),
    ).rejects.toMatchObject({ code: "PROMOTION_REPLAY_CONFLICT" });
  });
  it("replays a matching request without duplicate records", async () => {
    db.promotionCampaign.findUnique.mockResolvedValue(campaign());
    db.adminActivityLog.findFirst.mockResolvedValue({ id: "receipt" });
    const r = await createBusinessPromotion("employee", draft);
    expect(r.reference).toBe("PROMO_public");
    expect(db.promotionCampaign.create).not.toHaveBeenCalled();
  });
  it("hides promotions owned by another business", async () => {
    db.promotionCampaign.findFirst.mockResolvedValue(null);
    await expect(
      getBusinessPromotion("employee", "other"),
    ).rejects.toMatchObject({ status: 404 });
    expect(
      db.promotionCampaign.findFirst.mock.calls[0][0].where.ownerStoreId,
    ).toBe("actual-store");
  });
  it("requires a current draft revision for edits", async () => {
    await expect(
      updateBusinessPromotion("employee", "PROMO_public", {
        draft,
        expectedRevision: 1,
      }),
    ).rejects.toMatchObject({ code: "PROMOTION_STALE" });
    expect(db.promotionCampaignVersion.update).not.toHaveBeenCalled();
  });
  it("submits by CAS and records the actual employee as submitter", async () => {
    await submitBusinessPromotion("employee", "PROMO_public", {
      expectedRevision: 0,
    });
    const call = db.promotionCampaignVersion.updateMany.mock.calls[0][0];
    expect(call.where).toEqual({
      id: "version",
      status: "DRAFT",
      clientDraftRevision: 0,
    });
    expect(call.data.status).toBe("UNDER_REVIEW");
    expect(call.data.submittedByUserId).toBe("employee");
  });
  it("rejects stale submissions without updating campaign status", async () => {
    db.promotionCampaignVersion.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      submitBusinessPromotion("employee", "PROMO_public", {
        expectedRevision: 0,
      }),
    ).rejects.toMatchObject({ code: "PROMOTION_STALE" });
    expect(db.promotionCampaign.update).not.toHaveBeenCalled();
  });
});

const admin = {
  id: "actual-admin",
  role: "ADMIN",
  status: "ACTIVE",
} as AuthenticatedUser;
describe("administrative promotion review", () => {
  it("denies missing approval permission", async () => {
    permitted.mockResolvedValue(false);
    await expect(
      reviewBusinessPromotion(admin, "PROMO_public", {
        decision: "APPROVE_RULES",
        expectedRevision: 0,
        reason: "Reviewed the submitted campaign rules.",
      }),
    ).rejects.toMatchObject({ status: 403 });
    expect(db.promotionCampaignVersion.updateMany).not.toHaveBeenCalled();
  });
  it("records real approval actor without creating budget or activating codes", async () => {
    await reviewBusinessPromotion(admin, "PROMO_public", {
      decision: "APPROVE_RULES",
      expectedRevision: 0,
      reason: "Reviewed the submitted campaign rules.",
    });
    const x = db.promotionCampaignVersion.updateMany.mock.calls[0][0];
    expect(x.where.status).toBe("UNDER_REVIEW");
    expect(x.data.status).toBe("APPROVED");
    expect(x.data.approvedByUserId).toBe("actual-admin");
    expect(x.data).not.toHaveProperty("budget");
    expect(db.promotionCode.deleteMany).not.toHaveBeenCalled();
  });
  it("returns requested changes to editable draft with feedback", async () => {
    await reviewBusinessPromotion(admin, "PROMO_public", {
      decision: "REQUEST_CHANGES",
      expectedRevision: 0,
      reason: "Please revise the campaign date range.",
    });
    const x = db.promotionCampaignVersion.updateMany.mock.calls[0][0];
    expect(x.data.status).toBe("DRAFT");
    expect(x.data.rejectionReason).toBe(
      "Please revise the campaign date range.",
    );
  });
  it("rejects self-review and stale submissions", async () => {
    db.promotionCampaign.findFirst.mockResolvedValue({
      ...campaign(),
      versions: [{ ...campaign().versions[0], submittedByUserId: admin.id }],
    });
    await expect(
      reviewBusinessPromotion(admin, "PROMO_public", {
        decision: "APPROVE_RULES",
        expectedRevision: 0,
        reason: "Reviewed the submitted campaign rules.",
      }),
    ).rejects.toMatchObject({ code: "PROMOTION_SELF_REVIEW" });
    db.promotionCampaign.findFirst.mockResolvedValue(campaign());
    db.promotionCampaignVersion.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      reviewBusinessPromotion(admin, "PROMO_public", {
        decision: "REQUEST_CHANGES",
        expectedRevision: 0,
        reason: "Please revise the campaign date range.",
      }),
    ).rejects.toMatchObject({ code: "PROMOTION_STALE" });
  });
});
