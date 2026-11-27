import type { Prisma } from "@prisma/client";
import { getGlobalCommercePolicyRevision } from "@/lib/admin/commerce-readiness-revision";
import { MarketplaceCheckoutError } from "@/lib/marketplace-checkout/errors";
import { selectStorePickupAddress } from "@/lib/marketplace-checkout/store-pickup-selection";
import {
  isStoreOperationalPolicyEffective,
  isStorePubliclyCheckoutReady,
  isStoreSellerIdentityEffective,
} from "@/lib/storefront/store-publication-readiness";

type StoreLiveCheckDb = Pick<
  Prisma.TransactionClient,
  | "store"
  | "storeSellerLegalIdentity"
  | "storeOrderOperationalPolicy"
  | "commissionPlan"
  | "storeCatalogOffer"
  | "systemSetting"
>;

export async function assertStoreCurrentlySellingLive(
  db: StoreLiveCheckDb,
  storeId: string,
  at = new Date(),
  code: "CHECKOUT_REVIEW_REQUIRED" | "PAYMENT_PREPARATION_BLOCKED" = "CHECKOUT_REVIEW_REQUIRED",
): Promise<void> {
  const [store, sellerIdentity, operationalPolicy, commissionPlan, globalPolicyRevision, sellableOfferCount] =
    await Promise.all([
      db.store.findUnique({
        where: { id: storeId },
        select: {
          id: true,
          status: true,
          name: true,
          isQaAcceptance: true,
          commerceReadinessRevision: true,
          defaultPickupAddress: true,
          savedAddresses: { where: { type: "PICKUP" } },
          checkoutCertification: true,
        },
      }),
      db.storeSellerLegalIdentity.findFirst({
        where: {
          storeId,
          status: "APPROVED",
          effectiveFrom: { lte: at },
          OR: [{ effectiveUntil: null }, { effectiveUntil: { gt: at } }],
        },
        select: { status: true, effectiveFrom: true, effectiveUntil: true },
        orderBy: [{ effectiveFrom: "desc" }, { id: "asc" }],
      }),
      db.storeOrderOperationalPolicy.findFirst({
        where: {
          status: "ACTIVE",
          effectiveFrom: { lte: at },
          OR: [{ effectiveUntil: null }, { effectiveUntil: { gt: at } }],
        },
        select: { status: true, effectiveFrom: true, effectiveUntil: true },
        orderBy: [{ effectiveFrom: "desc" }, { versionNumber: "desc" }],
      }),
      db.commissionPlan.findFirst({
        where: {
          subjectType: "MARKETPLACE_STORE_ORDER",
          scopeKey: `STORE:${storeId}`,
          currency: "ZAR",
          status: "ACTIVE",
          approvedAt: { not: null },
          effectiveFrom: { lte: at },
          OR: [{ effectiveUntil: null }, { effectiveUntil: { gt: at } }],
        },
        select: { id: true },
      }),
      getGlobalCommercePolicyRevision(db as unknown as Prisma.TransactionClient),
      db.storeCatalogOffer.count({
        where: {
          storeId,
          status: "ACTIVE",
          publicationStatus: "PUBLISHED",
          currentPriceVersionId: { not: null },
          priceVersions: {
            some: {
              status: "ACTIVE",
              effectiveFrom: { lte: at },
              OR: [{ effectiveUntil: null }, { effectiveUntil: { gt: at } }],
            },
          },
          OR: [
            { inventoryTrackingMode: "UNTRACKED" },
            {
              inventoryItem: {
                levels: {
                  some: {
                    available: { gte: 1 },
                    location: { status: "ACTIVE" },
                  },
                },
              },
            },
          ],
        },
      }),
    ]);

  const pickup = store
    ? selectStorePickupAddress(store.id, store.defaultPickupAddress, store.savedAddresses)
    : null;
  const ready =
    Boolean(store) &&
    isStorePubliclyCheckoutReady({
      status: store!.status,
      name: store!.name,
      documentsCount: sellableOfferCount,
      pickup,
      certification: store!.checkoutCertification,
      hasApprovedSellerIdentity: isStoreSellerIdentityEffective(sellerIdentity, at),
      hasActiveOperationalPolicy: isStoreOperationalPolicyEffective(operationalPolicy, at),
      hasActiveCommissionPlan: Boolean(commissionPlan),
      storeCommerceReadinessRevision: store!.commerceReadinessRevision,
      currentGlobalPolicyRevision: globalPolicyRevision,
      isQaAcceptanceStore: Boolean((store as { isQaAcceptance?: boolean } | null)?.isQaAcceptance),
      now: at,
    });

  if (!ready) {
    throw new MarketplaceCheckoutError(
      code,
      "This store is no longer live for checkout. Please refresh your cart or checkout review before paying.",
    );
  }
}
