import { describeStoreCollectionEvidence } from "@/lib/admin/store-pickup-readiness";
import {
  isStorePubliclyCheckoutReady,
  type PublicStoreCheckoutCertificate,
} from "@/lib/storefront/store-publication-readiness";
import type { StorePickupAddressCandidate } from "@/lib/marketplace-checkout/store-pickup-selection";

export type AdminStoreCheckoutFacts = Readonly<{
  status: string;
  name: string;
  publishedOfferCount: number;
  pickup: StorePickupAddressCandidate | null;
  certification: PublicStoreCheckoutCertificate | null;
  hasApprovedSellerIdentity?: boolean;
  hasActiveOperationalPolicy?: boolean;
  now?: Date;
}>;

/** Read-only operational reasons for the admin store inventory.
 * No reason returned here is a substitute for the server's actual route
 * and payment check when the customer submits a checkout.
 */
export function describeStoreCheckoutBlockers(input: AdminStoreCheckoutFacts): string[] {
  const blockers: string[] = [];
  if (input.status !== "ACTIVE") blockers.push("Store account needs activation");
  if (!input.name.trim()) blockers.push("Store name missing");
  if (!Number.isSafeInteger(input.publishedOfferCount) || input.publishedOfferCount < 1) {
    blockers.push("No published products available");
  }
  if (input.hasApprovedSellerIdentity === false) {
    blockers.push("Approved legal seller identity missing or expired");
  }
  if (input.hasActiveOperationalPolicy === false) {
    blockers.push("Active store order operational policy missing or expired");
  }

  const collection = describeStoreCollectionEvidence(input.pickup);
  if (!collection.checkoutPickupConfigured) blockers.push(...collection.missing);

  const cert = input.certification;
  const now = input.now ?? new Date();
  if (!cert) {
    blockers.push("Independent route and checkout certification missing");
  } else {
    if (cert.status !== "APPROVED" || !cert.approvedAt || !cert.approvedByUserId ||
      cert.approvedByUserId === cert.preparedByUserId ||
      !/^[a-f0-9]{64}$/.test(cert.routeEvidenceDigest ?? "") ||
      !/^[a-f0-9]{64}$/.test(cert.checkoutEvidenceDigest ?? "")) {
      blockers.push("Independent route and paid-checkout review incomplete");
    }
    if (!(cert.expiresAt instanceof Date) || !Number.isFinite(cert.expiresAt.getTime()) ||
      cert.expiresAt.getTime() <= now.getTime()) blockers.push("Checkout certification expired");
    if (input.pickup?.id && cert.pickupAddressId !== input.pickup.id) {
      blockers.push("Collection address changed since checkout certification");
    }
  }

  if (!isStorePubliclyCheckoutReady({
    status: input.status,
    name: input.name,
    documentsCount: input.publishedOfferCount,
    pickup: input.pickup,
    certification: input.certification,
    hasApprovedSellerIdentity: input.hasApprovedSellerIdentity,
    hasActiveOperationalPolicy: input.hasActiveOperationalPolicy,
    now,
  }) && blockers.length === 0) {
    blockers.push("Reconfirm the saved pickup against current approved checkout evidence");
  }
  return blockers;
}
