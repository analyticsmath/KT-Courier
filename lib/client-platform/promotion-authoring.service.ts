import { createHash, randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { storeAccess } from "./store-access";
import { hasPermission } from "@/lib/auth/permissions";
import type { AuthenticatedUser } from "@/types/domain";
import { PlatformError } from "./contracts";
import {
  computeCodeHmac,
  computeCodeFingerprint,
  maskPromotionCode,
} from "@/lib/promotions/promotion-code-policy";

const amount = z
  .string()
  .regex(/^(?:0|[1-9]\d{0,6})(?:\.\d{1,2})?$/)
  .refine((v) => new Prisma.Decimal(v).gt(0), "Enter a positive amount.");
export const PromotionDraftSchema = z
  .object({
    requestId: z.uuid(),
    name: z.string().trim().min(3).max(120),
    description: z.string().trim().min(10).max(1000),
    mechanism: z.enum(["PERCENTAGE", "FIXED_AMOUNT"]),
    value: amount,
    maximumDiscountAmount: amount.nullable().default(null),
    minimumSubtotal: amount.nullable().default(null),
    proposedBudget: amount,
    startsAt: z.iso.datetime(),
    endsAt: z.iso.datetime(),
    globalLimit: z.number().int().min(1).max(1000000),
    perCustomerLimit: z.number().int().min(1).max(1000),
    productIds: z.array(z.string().cuid()).max(100).default([]),
    categoryIds: z.array(z.string().cuid()).max(30).default([]),
    coupon: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9]{6,32}$/)
      .nullable()
      .default(null),
  })
  .strict()
  .superRefine((v, c) => {
    if (v.mechanism === "PERCENTAGE" && new Prisma.Decimal(v.value).gt(100))
      c.addIssue({
        code: "custom",
        path: ["value"],
        message: "Percentage cannot exceed 100%.",
      });
    if (
      new Date(v.endsAt) <= new Date(v.startsAt) ||
      new Date(v.endsAt).getTime() - new Date(v.startsAt).getTime() >
        366 * 86400000
    )
      c.addIssue({
        code: "custom",
        path: ["endsAt"],
        message: "Choose an end after the start, within 366 days.",
      });
    if (v.perCustomerLimit > v.globalLimit)
      c.addIssue({
        code: "custom",
        path: ["perCustomerLimit"],
        message: "Customer limit cannot exceed total uses.",
      });
    if (
      new Set(v.productIds).size !== v.productIds.length ||
      new Set(v.categoryIds).size !== v.categoryIds.length
    )
      c.addIssue({
        code: "custom",
        path: ["productIds"],
        message: "Choose each target once.",
      });
  });
export const PromotionUpdateSchema = z
  .object({
    draft: PromotionDraftSchema,
    expectedRevision: z.number().int().nonnegative(),
  })
  .strict();
export const PromotionSubmitSchema = z
  .object({ expectedRevision: z.number().int().nonnegative() })
  .strict();
const include = {
  versions: {
    orderBy: { versionNumber: "desc" as const },
    take: 1,
    include: {
      targets: true,
      codes: { select: { maskedDisplay: true } },
      budget: true,
      _count: { select: { redemptions: true } },
    },
  },
};
type Campaign = Prisma.PromotionCampaignGetPayload<{ include: typeof include }>;
export function promotionDraftProjection(c: Campaign) {
  const v = c.versions[0];
  if (!v)
    throw new PlatformError(
      "PROMOTION_INVALID",
      "Campaign has no version.",
      409,
    );
  return {
    reference: c.publicReference,
    name: c.name,
    status: v.status,
    description: v.promotionDescription ?? "",
    revision: v.clientDraftRevision,
    mechanism: v.discountMechanism,
    value:
      v.discountMechanism === "PERCENTAGE"
        ? v.percentageValue!.div(100).toFixed(2)
        : v.fixedAmount!.toFixed(2),
    maximumDiscountAmount: v.maximumDiscountAmount?.toFixed(2) ?? null,
    minimumSubtotal: v.minimumEligibleSubtotal?.toFixed(2) ?? null,
    proposedBudget: v.proposedBudgetAmount?.toFixed(2) ?? "0.00",
    startsAt: v.startsAt.toISOString(),
    endsAt: v.endsAt.toISOString(),
    globalLimit: v.maximumRedemptionsGlobal ?? 0,
    perCustomerLimit: v.maximumRedemptionsPerCustomer ?? 0,
    productIds: v.targets
      .filter((t) => t.targetType === "PRODUCT")
      .map((t) => t.targetReference),
    categoryIds: v.targets
      .filter((t) => t.targetType === "CATEGORY")
      .map((t) => t.targetReference),
    couponMasked: v.codes[0]?.maskedDisplay ?? null,
    redemptions: v._count.redemptions,
    hasApprovedBudget: !!v.budget,
    reviewFeedback: v.rejectionReason,
  };
}
export async function listBusinessPromotions(userId: string) {
  const a = await storeAccess(userId, "marketing");
  const rows = await prisma.promotionCampaign.findMany({
    where: { ownerType: "STORE", ownerStoreId: a.store.id },
    include,
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return rows.map(promotionDraftProjection);
}
export async function getBusinessPromotion(userId: string, reference: string) {
  const a = await storeAccess(userId, "marketing");
  const c = await prisma.promotionCampaign.findFirst({
    where: {
      publicReference: reference,
      ownerType: "STORE",
      ownerStoreId: a.store.id,
    },
    include,
  });
  if (!c)
    throw new PlatformError("PROMOTION_NOT_FOUND", "Promotion not found.", 404);
  return promotionDraftProjection(c);
}
export async function businessPromotionTargets(userId: string) {
  const a = await storeAccess(userId, "marketing");
  const offers = await prisma.storeCatalogOffer.findMany({
    where: { storeId: a.store.id, status: { not: "ARCHIVED" } },
    select: {
      product: {
        select: {
          id: true,
          title: true,
          primaryCategory: { select: { id: true, name: true } },
        },
      },
    },
    take: 1001,
    orderBy: { createdAt: "desc" },
  });
  if (offers.length > 1000)
    throw new PlatformError(
      "TARGETS_TOO_LARGE",
      "Contact support to prepare targets for this large catalog.",
      422,
    );
  return {
    products: [
      ...new Map(
        offers.map((o) => [
          o.product.id,
          { id: o.product.id, name: o.product.title },
        ]),
      ).values(),
    ],
    categories: [
      ...new Map(
        offers.map((o) => [
          o.product.primaryCategory.id,
          o.product.primaryCategory,
        ]),
      ).values(),
    ],
  };
}
function couponData(d: z.infer<typeof PromotionDraftSchema>) {
  if (!d.coupon) return null;
  const key = process.env.PROMOTION_CODE_HMAC_KEY;
  if (!key || key.length < 32)
    throw new PlatformError(
      "COUPON_CONFIGURATION",
      "Coupon setup is unavailable. Contact support or save an automatic promotion.",
      503,
    );
  return {
    publicReference: `PC_${randomUUID()}`,
    codeHmac: computeCodeHmac(d.coupon, key),
    codeFingerprint: computeCodeFingerprint(d.coupon),
    maskedDisplay: maskPromotionCode(d.coupon),
    status: "DRAFT" as const,
    startsAt: new Date(d.startsAt),
    expiresAt: new Date(d.endsAt),
    maximumRedemptions: d.globalLimit,
    maximumRedemptionsPerCustomer: d.perCustomerLimit,
  };
}
async function validateTargets(
  tx: Prisma.TransactionClient,
  storeId: string,
  d: z.infer<typeof PromotionDraftSchema>,
) {
  const [products, categories] = await Promise.all([
    tx.storeCatalogOffer.findMany({
      where: { storeId, productId: { in: d.productIds } },
      select: { productId: true },
      distinct: ["productId"],
    }),
    tx.storeCatalogOffer.findMany({
      where: { storeId, product: { primaryCategoryId: { in: d.categoryIds } } },
      select: { product: { select: { primaryCategoryId: true } } },
      distinct: ["productId"],
    }),
  ]);
  if (
    products.length !== d.productIds.length ||
    new Set(categories.map((c) => c.product.primaryCategoryId)).size !==
      d.categoryIds.length
  )
    throw new PlatformError(
      "PROMOTION_TARGET_SCOPE",
      "Select products and categories from your business catalog.",
      422,
    );
}
function versionData(d: z.infer<typeof PromotionDraftSchema>) {
  return {
    applicationMethod: d.coupon
      ? ("COUPON_CODE" as const)
      : ("AUTOMATIC" as const),
    discountScope: "LINE" as const,
    discountMechanism: d.mechanism,
    percentageValue:
      d.mechanism === "PERCENTAGE"
        ? new Prisma.Decimal(d.value).mul(100)
        : null,
    fixedAmount:
      d.mechanism === "FIXED_AMOUNT" ? new Prisma.Decimal(d.value) : null,
    maximumDiscountAmount: d.maximumDiscountAmount
      ? new Prisma.Decimal(d.maximumDiscountAmount)
      : null,
    minimumEligibleSubtotal: d.minimumSubtotal
      ? new Prisma.Decimal(d.minimumSubtotal)
      : null,
    proposedBudgetAmount: new Prisma.Decimal(d.proposedBudget),
    maximumRedemptionsGlobal: d.globalLimit,
    maximumRedemptionsPerCustomer: d.perCustomerLimit,
    startsAt: new Date(d.startsAt),
    endsAt: new Date(d.endsAt),
    promotionDescription: d.description,
    customerFacingTitle: d.name,
    customerFacingDescription: d.description,
  };
}
function targetData(storeId: string, d: z.infer<typeof PromotionDraftSchema>) {
  return [
    { targetType: "STORE" as const, targetReference: storeId },
    ...d.productIds.map((id) => ({
      targetType: "PRODUCT" as const,
      targetReference: id,
    })),
    ...d.categoryIds.map((id) => ({
      targetType: "CATEGORY" as const,
      targetReference: id,
    })),
  ];
}
export async function createBusinessPromotion(userId: string, raw: unknown) {
  const d = PromotionDraftSchema.parse(raw),
    a = await storeAccess(userId, "marketing");
  if (a.store.status !== "ACTIVE")
    throw new PlatformError(
      "BUSINESS_INACTIVE",
      "An approved active business is required.",
      403,
    );
  const code = couponData(d),
    internalCode = `CLIENT_${a.store.id}_${d.requestId}`,
    requestHash = createHash("sha256")
      .update(JSON.stringify({ ...d, coupon: code?.codeHmac ?? null }))
      .digest("hex");
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${internalCode},0))`;
    const prior = await tx.promotionCampaign.findUnique({
      where: { internalCode },
      include,
    });
    if (prior) {
      const receipt = await tx.adminActivityLog.findFirst({
        where: {
          entityType: "PromotionCampaign",
          entityId: prior.id,
          metadata: { path: ["requestHash"], equals: requestHash },
        },
      });
      if (!receipt)
        throw new PlatformError(
          "PROMOTION_REPLAY_CONFLICT",
          "This request was already used for different promotion details.",
          409,
        );
      return promotionDraftProjection(prior);
    }
    await validateTargets(tx, a.store.id, d);
    const c = await tx.promotionCampaign.create({
      data: {
        publicReference: `PROMO_${randomUUID()}`,
        internalCode,
        ownerType: "STORE",
        ownerStoreId: a.store.id,
        name: d.name,
        purpose: d.description,
        versions: {
          create: {
            ...versionData(d),
            publicReference: `PV_${randomUUID()}`,
            versionNumber: 1,
            fundingType: "STORE_FUNDED",
            storeFundingShareBps: 10000,
            platformFundingShareBps: 0,
            targets: { create: targetData(a.store.id, d) },
            ...(code ? { codes: { create: code } } : {}),
            statusHistory: {
              create: {
                toStatus: "DRAFT",
                actorUserId: userId,
                operationId: d.requestId,
                reason: "Business created promotion draft",
              },
            },
          },
        },
      },
      include,
    });
    await tx.adminActivityLog.create({
      data: {
        actorUserId: userId,
        action: "CREATE",
        entityType: "PromotionCampaign",
        entityId: c.id,
        message: "Business created promotion draft",
        metadata: { storeId: a.store.id, requestHash },
      },
    });
    return promotionDraftProjection(c);
  });
}
export async function updateBusinessPromotion(
  userId: string,
  reference: string,
  raw: unknown,
) {
  const input = PromotionUpdateSchema.parse(raw),
    d = input.draft,
    a = await storeAccess(userId, "marketing"),
    code = couponData(d);
  return prisma.$transaction(async (tx) => {
    const c = await tx.promotionCampaign.findFirst({
      where: {
        publicReference: reference,
        ownerStoreId: a.store.id,
        ownerType: "STORE",
      },
      include,
    });
    if (!c)
      throw new PlatformError(
        "PROMOTION_NOT_FOUND",
        "Promotion not found.",
        404,
      );
    await tx.$queryRaw`SELECT id FROM "PromotionCampaignVersion" WHERE id=${c.versions[0].id} FOR UPDATE`;
    const v = await tx.promotionCampaignVersion.findUniqueOrThrow({
      where: { id: c.versions[0].id },
    });
    if (
      v.status !== "DRAFT" ||
      v.clientDraftRevision !== input.expectedRevision
    )
      throw new PlatformError(
        "PROMOTION_STALE",
        "The draft changed or was submitted. Reload before editing.",
        409,
      );
    await validateTargets(tx, a.store.id, d);
    await tx.promotionCampaignVersionTarget.deleteMany({
      where: { campaignVersionId: v.id },
    });
    // Only never-activated draft codes may be replaced. Codes referenced by financial records remain immutable.
    await tx.promotionCode.deleteMany({
      where: { campaignVersionId: v.id, status: "DRAFT" },
    });
    await tx.promotionCampaign.update({
      where: { id: c.id },
      data: { name: d.name, purpose: d.description },
    });
    await tx.promotionCampaignVersion.update({
      where: { id: v.id },
      data: {
        ...versionData(d),
        clientDraftRevision: { increment: 1 },
        targets: { create: targetData(a.store.id, d) },
        ...(code ? { codes: { create: code } } : {}),
      },
    });
    await tx.adminActivityLog.create({
      data: {
        actorUserId: userId,
        action: "UPDATE",
        entityType: "PromotionCampaign",
        entityId: c.id,
        message: "Business updated promotion draft",
        metadata: { storeId: a.store.id, revision: input.expectedRevision + 1 },
      },
    });
    return promotionDraftProjection(
      await tx.promotionCampaign.findUniqueOrThrow({
        where: { id: c.id },
        include,
      }),
    );
  });
}
export async function submitBusinessPromotion(
  userId: string,
  reference: string,
  raw: unknown,
) {
  const input = PromotionSubmitSchema.parse(raw),
    a = await storeAccess(userId, "marketing");
  return prisma.$transaction(async (tx) => {
    const c = await tx.promotionCampaign.findFirst({
      where: {
        publicReference: reference,
        ownerStoreId: a.store.id,
        ownerType: "STORE",
      },
      include,
    });
    if (!c)
      throw new PlatformError(
        "PROMOTION_NOT_FOUND",
        "Promotion not found.",
        404,
      );
    const v = c.versions[0];
    if (v.endsAt <= new Date())
      throw new PlatformError(
        "PROMOTION_EXPIRED",
        "Update the dates before submitting this promotion.",
        422,
      );
    const change = await tx.promotionCampaignVersion.updateMany({
      where: {
        id: v.id,
        status: "DRAFT",
        clientDraftRevision: input.expectedRevision,
      },
      data: {
        status: "UNDER_REVIEW",
        submittedAt: new Date(),
        submittedByUserId: userId,
        rejectionReason: null,
        rejectedAt: null,
        rejectedByUserId: null,
        clientDraftRevision: { increment: 1 },
      },
    });
    if (change.count !== 1)
      throw new PlatformError(
        "PROMOTION_STALE",
        "The draft changed or was already submitted. Reload before submitting.",
        409,
      );
    await tx.promotionCampaign.update({
      where: { id: c.id },
      data: { status: "UNDER_REVIEW" },
    });
    await tx.promotionStatusHistory.create({
      data: {
        campaignVersionId: v.id,
        fromStatus: "DRAFT",
        toStatus: "UNDER_REVIEW",
        actorUserId: userId,
        reason: "Business submitted promotion for review",
      },
    });
    await tx.adminActivityLog.create({
      data: {
        actorUserId: userId,
        action: "UPDATE",
        entityType: "PromotionCampaign",
        entityId: c.id,
        message: "Business submitted promotion for review",
        metadata: { storeId: a.store.id, versionId: v.id },
      },
    });
    return promotionDraftProjection(
      await tx.promotionCampaign.findUniqueOrThrow({
        where: { id: c.id },
        include,
      }),
    );
  });
}
export type BusinessPromotion = ReturnType<typeof promotionDraftProjection>;
export async function businessPromotionFinancialView(
  userId: string,
  reference: string,
) {
  const a = await storeAccess(userId, "marketing");
  const c = await prisma.promotionCampaign.findFirst({
    where: {
      publicReference: reference,
      ownerType: "STORE",
      ownerStoreId: a.store.id,
    },
    select: {
      name: true,
      versions: {
        orderBy: { versionNumber: "desc" },
        take: 1,
        select: {
          versionNumber: true,
          budget: true,
          redemptions: {
            orderBy: { createdAt: "desc" },
            take: 200,
            select: {
              publicReference: true,
              status: true,
              discountAmount: true,
              storeFunding: true,
              createdAt: true,
            },
          },
        },
      },
    },
  });
  if (!c || !c.versions[0])
    throw new PlatformError("PROMOTION_NOT_FOUND", "Promotion not found.", 404);
  const v = c.versions[0],
    b = v.budget;
  return {
    name: c.name,
    version: v.versionNumber,
    budget: b
      ? {
          currency: b.currency,
          status: b.status,
          approved: b.approvedAmount.toFixed(2),
          reserved: b.reservedAmount.toFixed(2),
          committed: b.committedAmount.toFixed(2),
          released: b.releasedAmount.toFixed(2),
          reversed: b.reversedAmount.toFixed(2),
        }
      : null,
    redemptions: v.redemptions.map((r) => ({
      ...r,
      discountAmount: r.discountAmount.toFixed(2),
      storeFunding: r.storeFunding.toFixed(2),
      createdAt: r.createdAt.toISOString(),
    })),
  };
}
async function authorizeAdmin(user: AuthenticatedUser, permission: string) {
  if (
    !["ADMIN", "SUPER_ADMIN"].includes(user.role) ||
    user.status !== "ACTIVE" ||
    !(await hasPermission({
      userId: user.id,
      role: user.role,
      permissionKey: permission,
    }))
  )
    throw new PlatformError(
      "PROMOTION_ADMIN_DENIED",
      "Promotion administration permission is required.",
      403,
    );
}
export async function listAdminPromotionRecords(user: AuthenticatedUser) {
  await authorizeAdmin(user, "promotions.read");
  const rows = await prisma.promotionCampaign.findMany({
    include: { ...include, ownerStore: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return rows.map((c) => ({
    ...promotionDraftProjection(c),
    storeName: c.ownerStore?.name ?? "Platform",
  }));
}
export async function getAdminPromotionRecord(
  user: AuthenticatedUser,
  reference: string,
) {
  await authorizeAdmin(user, "promotions.read");
  const c = await prisma.promotionCampaign.findUnique({
    where: { publicReference: reference },
    include: { ...include, ownerStore: { select: { name: true } } },
  });
  if (!c)
    throw new PlatformError("PROMOTION_NOT_FOUND", "Promotion not found.", 404);
  return {
    ...promotionDraftProjection(c),
    storeName: c.ownerStore?.name ?? "Platform",
  };
}
export const PromotionReviewSchema = z
  .object({
    decision: z.enum(["APPROVE_RULES", "REQUEST_CHANGES"]),
    expectedRevision: z.number().int().nonnegative(),
    reason: z.string().trim().min(10).max(1000),
  })
  .strict();
export async function reviewBusinessPromotion(
  user: AuthenticatedUser,
  reference: string,
  raw: unknown,
) {
  const d = PromotionReviewSchema.parse(raw);
  await authorizeAdmin(
    user,
    d.decision === "APPROVE_RULES" ? "promotions.approve" : "promotions.review",
  );
  return prisma.$transaction(async (tx) => {
    const c = await tx.promotionCampaign.findFirst({
      where: { publicReference: reference, ownerType: "STORE" },
      include,
    });
    if (!c)
      throw new PlatformError(
        "PROMOTION_NOT_FOUND",
        "Business promotion not found.",
        404,
      );
    const v = c.versions[0],
      status = d.decision === "APPROVE_RULES" ? "APPROVED" : "DRAFT";
    if (v.endsAt <= new Date() && status === "APPROVED")
      throw new PlatformError(
        "PROMOTION_EXPIRED",
        "An expired promotion cannot be approved.",
        422,
      );
    if (v.submittedByUserId === user.id)
      throw new PlatformError(
        "PROMOTION_SELF_REVIEW",
        "A different administrator must review this submission.",
        403,
      );
    const change = await tx.promotionCampaignVersion.updateMany({
      where: {
        id: v.id,
        status: "UNDER_REVIEW",
        clientDraftRevision: d.expectedRevision,
      },
      data: {
        status,
        clientDraftRevision: { increment: 1 },
        ...(status === "APPROVED"
          ? { approvedAt: new Date(), approvedByUserId: user.id }
          : {
              rejectedAt: new Date(),
              rejectedByUserId: user.id,
              rejectionReason: d.reason,
            }),
      },
    });
    if (change.count !== 1)
      throw new PlatformError(
        "PROMOTION_STALE",
        "The submission changed or was already reviewed. Reload before reviewing.",
        409,
      );
    await tx.promotionCampaign.update({
      where: { id: c.id },
      data: { status },
    });
    await tx.promotionStatusHistory.create({
      data: {
        campaignVersionId: v.id,
        fromStatus: "UNDER_REVIEW",
        toStatus: status,
        actorUserId: user.id,
        reason: d.reason,
      },
    });
    await tx.adminActivityLog.create({
      data: {
        actorUserId: user.id,
        action: "UPDATE",
        entityType: "PromotionCampaign",
        entityId: c.id,
        message:
          status === "APPROVED"
            ? "Administrator approved campaign rules, without activation or funding"
            : "Administrator requested campaign changes",
        metadata: {
          decision: d.decision,
          reason: d.reason,
          versionId: v.id,
          storeId: c.ownerStoreId,
        },
      },
    });
    return promotionDraftProjection(
      await tx.promotionCampaign.findUniqueOrThrow({
        where: { id: c.id },
        include,
      }),
    );
  });
}
