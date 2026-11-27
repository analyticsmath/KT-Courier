import { pickupCertificationFingerprint } from "@/lib/admin/store-checkout-certification.service";
import { REAL_CHECKOUT_PROOF_EVIDENCE_TYPE } from "@/lib/admin/store-checkout-proof-constants";
import {
  completeStorePickupAddress,
  type StorePickupAddressCandidate,
} from "@/lib/marketplace-checkout/store-pickup-selection";

export type PublicStoreCheckoutCertificate = Readonly<{
  status: string;
  evidenceType?: string | null;
  pickupAddressId: string;
  pickupFingerprint: string;
  preparedByUserId: string;
  approvedByUserId: string | null;
  approvedAt: Date | null;
  expiresAt: Date;
  routeEvidenceDigest: string | null;
  checkoutEvidenceDigest: string | null;
  engineProofDigest?: string | null;
  proofOfferReference?: string | null;
  proofPriceVersionReference?: string | null;
  proofMetadata?: unknown;
  sourceCommerceReadinessRevision?: number | null;
  globalPolicyRevision?: number | null;
}>;

export function isQaOnlyCheckoutProofMetadata(metadata: unknown): boolean {
  return Boolean(
    metadata &&
      typeof metadata === "object" &&
      !Array.isArray(metadata) &&
      (metadata as { qaAcceptanceOnly?: unknown }).qaAcceptanceOnly === true,
  );
}

export type StoreSellerIdentityReadinessFact = Readonly<{
  status: string;
  effectiveFrom: Date;
  effectiveUntil?: Date | null;
}> | null | undefined;

export type StoreOperationalPolicyReadinessFact = Readonly<{
  status: string;
  effectiveFrom: Date;
  effectiveUntil?: Date | null;
}> | null | undefined;

export function isStoreSellerIdentityEffective(
  identity: StoreSellerIdentityReadinessFact,
  now = new Date(),
): boolean {
  if (!identity) return false;
  return (
    identity.status === "APPROVED" &&
    identity.effectiveFrom instanceof Date &&
    identity.effectiveFrom.getTime() <= now.getTime() &&
    (!identity.effectiveUntil || identity.effectiveUntil.getTime() > now.getTime())
  );
}

export function isStoreOperationalPolicyEffective(
  policy: StoreOperationalPolicyReadinessFact,
  now = new Date(),
): boolean {
  if (!policy) return false;
  return (
    policy.status === "ACTIVE" &&
    policy.effectiveFrom instanceof Date &&
    policy.effectiveFrom.getTime() <= now.getTime() &&
    (!policy.effectiveUntil || policy.effectiveUntil.getTime() > now.getTime())
  );
}

/** Public Live status must not be based on legacy ACTIVE flags or a map pin
 * alone. It requires independently reviewed route AND paid-checkout receipts
 * bound to the exact current store-owned collection point, plus an effective
 * approved seller legal identity and active operational policy.
 *
 * An expired/revoked certificate also invalidates a previously-built
 * projection; reading the storefront must separately recheck this authority
 * when serving documents cached before expiry.
 */
export function isStorePubliclyCheckoutReady(input: Readonly<{
  status: string;
  name: string;
  documentsCount: number;
  pickup: StorePickupAddressCandidate | null;
  certification: PublicStoreCheckoutCertificate | null;
  hasApprovedSellerIdentity: boolean;
  hasActiveOperationalPolicy: boolean;
  hasActiveCommissionPlan: boolean;
  storeCommerceReadinessRevision: number;
  currentGlobalPolicyRevision: number;
  isQaAcceptanceStore?: boolean;
  now?: Date;
}>): boolean {
  const { pickup, certification } = input;
  if (
    input.hasApprovedSellerIdentity !== true ||
    input.hasActiveOperationalPolicy !== true ||
    input.hasActiveCommissionPlan !== true
  ) {
    return false;
  }
  if (
    !Number.isSafeInteger(input.storeCommerceReadinessRevision) ||
    input.storeCommerceReadinessRevision < 1 ||
    !Number.isSafeInteger(input.currentGlobalPolicyRevision) ||
    input.currentGlobalPolicyRevision < 1
  ) {
    return false;
  }
  if (input.status !== "ACTIVE" || input.name.trim().length === 0 ||
      !Number.isSafeInteger(input.documentsCount) || input.documentsCount <= 0 ||
      !pickup?.id || !pickup.storeId || pickup.type !== "PICKUP" ||
      !completeStorePickupAddress(pickup) || !certification) return false;
  if (input.isQaAcceptanceStore !== true && isQaOnlyCheckoutProofMetadata(certification.proofMetadata)) {
    return false;
  }
  if (certification.status !== "APPROVED" ||
      certification.evidenceType !== REAL_CHECKOUT_PROOF_EVIDENCE_TYPE ||
      !certification.approvedByUserId || !certification.preparedByUserId ||
      certification.approvedByUserId === certification.preparedByUserId ||
      !(certification.approvedAt instanceof Date) ||
      !Number.isFinite(certification.approvedAt.getTime()) ||
      !(certification.expiresAt instanceof Date) ||
      !Number.isFinite(certification.expiresAt.getTime()) ||
      certification.expiresAt.getTime() <= (input.now ?? new Date()).getTime() ||
      !/^[a-f0-9]{64}$/.test(certification.routeEvidenceDigest ?? "") ||
      !/^[a-f0-9]{64}$/.test(certification.checkoutEvidenceDigest ?? "") ||
      !/^[a-f0-9]{64}$/.test(certification.engineProofDigest ?? "") ||
      typeof certification.proofOfferReference !== "string" ||
      certification.proofOfferReference.trim().length === 0 ||
      typeof certification.proofPriceVersionReference !== "string" ||
      certification.proofPriceVersionReference.trim().length === 0 ||
      certification.sourceCommerceReadinessRevision !== input.storeCommerceReadinessRevision ||
      certification.globalPolicyRevision !== input.currentGlobalPolicyRevision ||
      certification.pickupAddressId !== pickup.id) return false;
  try {
    return certification.pickupFingerprint === pickupCertificationFingerprint(pickup);
  } catch {
    return false;
  }
}
