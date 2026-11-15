import type { Prisma } from "@prisma/client";
import { bumpStoreCommerceReadinessRevision } from "@/lib/admin/commerce-readiness-revision";
import { rebuildStorefrontStoreDocument } from "@/lib/services/storefront-store.service";

export async function invalidateStoreCheckoutReadinessInTx(
  tx: Prisma.TransactionClient,
  storeId: string,
): Promise<number> {
  const nextRevision = await bumpStoreCommerceReadinessRevision(tx, storeId);
  const client = tx as unknown as {
    storefrontStoreDocument?: { updateMany?: unknown };
    store?: { findUnique?: unknown };
  };
  if (client.storefrontStoreDocument && typeof client.store?.findUnique === "function") {
    await rebuildStorefrontStoreDocument(storeId, tx);
  }
  return nextRevision;
}

export async function isApprovedCertProofOffer(
  tx: Prisma.TransactionClient,
  storeId: string,
  offerPublicReference: string,
): Promise<boolean> {
  const client = tx as unknown as {
    storeCheckoutCertification?: Partial<Prisma.TransactionClient["storeCheckoutCertification"]>;
  };
  if (typeof client.storeCheckoutCertification?.findFirst !== "function") {
    return false;
  }
  const cert = await tx.storeCheckoutCertification.findFirst({
    where: { storeId, status: "APPROVED" },
    orderBy: { revision: "desc" },
    select: { proofOfferReference: true },
  });
  return cert?.proofOfferReference === offerPublicReference;
}

export async function getApprovedCertProof(
  tx: Prisma.TransactionClient,
  storeId: string,
): Promise<{ proofOfferReference: string | null; proofPriceVersionReference: string | null } | null> {
  const client = tx as unknown as {
    storeCheckoutCertification?: Partial<Prisma.TransactionClient["storeCheckoutCertification"]>;
  };
  if (typeof client.storeCheckoutCertification?.findFirst !== "function") {
    return null;
  }
  return tx.storeCheckoutCertification.findFirst({
    where: { storeId, status: "APPROVED" },
    orderBy: { revision: "desc" },
    select: { proofOfferReference: true, proofPriceVersionReference: true },
  });
}

export async function syncStoreReadinessAfterCatalogOfferChange(
  tx: Prisma.TransactionClient,
  storeId: string,
  touchedOfferReferences: readonly string[],
): Promise<void> {
  const client = tx as unknown as {
    storeCatalogOffer?: Partial<Prisma.TransactionClient["storeCatalogOffer"]>;
    storefrontStoreDocument?: { updateMany?: unknown };
    store?: { findUnique?: unknown };
  };
  if (typeof client.storeCatalogOffer?.findMany !== "function") {
    await invalidateStoreCheckoutReadinessInTx(tx, storeId);
    return;
  }
  const approvedCert = await getApprovedCertProof(tx, storeId);
  const touchedProofOffer = Boolean(
    approvedCert?.proofOfferReference &&
      touchedOfferReferences.includes(approvedCert.proofOfferReference),
  );
  if (touchedProofOffer) {
    await invalidateStoreCheckoutReadinessInTx(tx, storeId);
    return;
  }
  const now = new Date();
  const candidateOffers = await tx.storeCatalogOffer.findMany({
    where: {
      storeId,
      status: "ACTIVE",
      publicationStatus: "PUBLISHED",
      currentPriceVersionId: { not: null },
      product: {
        status: "ACTIVE",
        primaryCategory: { status: "ACTIVE" },
        productTypeDefinition: { status: "ACTIVE" },
      },
      variant: { status: "ACTIVE" },
      priceVersions: {
        some: {
          status: "ACTIVE",
          currency: "ZAR",
          effectiveFrom: { lte: now },
          OR: [{ effectiveUntil: null }, { effectiveUntil: { gt: now } }],
        },
      },
    },
    select: {
      id: true,
      minimumQuantity: true,
      inventoryTrackingMode: true,
      inventoryItem: {
        select: {
          allowBackorder: true,
          levels: {
            where: { location: { status: "ACTIVE" } },
            select: { available: true },
          },
        },
      },
    },
  });
  const remainingSellableCount = candidateOffers.filter((offer) => {
    if (offer.inventoryTrackingMode === "UNTRACKED" || offer.inventoryItem?.allowBackorder) {
      return true;
    }
    const totalAvailable = (offer.inventoryItem?.levels ?? []).reduce(
      (sum, level) => sum + level.available,
      0,
    );
    return totalAvailable >= Math.max(1, Number(offer.minimumQuantity));
  }).length;
  if (remainingSellableCount === 0) {
    await invalidateStoreCheckoutReadinessInTx(tx, storeId);
    return;
  }
  if (client.storefrontStoreDocument && typeof client.store?.findUnique === "function") {
    await rebuildStorefrontStoreDocument(storeId, tx);
  }
}
