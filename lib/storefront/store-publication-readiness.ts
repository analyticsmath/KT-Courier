import { pickupCertificationFingerprint } from "@/lib/admin/store-checkout-certification.service";
import {
  completeStorePickupAddress,
  type StorePickupAddressCandidate,
} from "@/lib/marketplace-checkout/store-pickup-selection";

export type PublicStoreCheckoutCertificate = Readonly<{
  status: string;
  pickupAddressId: string;
  pickupFingerprint: string;
  preparedByUserId: string;
  approvedByUserId: string | null;
  approvedAt: Date | null;
  expiresAt: Date;
  routeEvidenceDigest: string | null;
  checkoutEvidenceDigest: string | null;
}>;

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
  now?: Date;
}>): boolean {
  const { pickup, certification } = input;
  if (input.hasApprovedSellerIdentity !== true || input.hasActiveOperationalPolicy !== true) {
    return false;
  }
  if (input.status !== "ACTIVE" || input.name.trim().length === 0 ||
      !Number.isSafeInteger(input.documentsCount) || input.documentsCount <= 0 ||
      !pickup?.id || !pickup.storeId || pickup.type !== "PICKUP" ||
      !completeStorePickupAddress(pickup) || !certification) return false;
  if (certification.status !== "APPROVED" ||
      !certification.approvedByUserId || !certification.preparedByUserId ||
      certification.approvedByUserId === certification.preparedByUserId ||
      !(certification.approvedAt instanceof Date) ||
      !Number.isFinite(certification.approvedAt.getTime()) ||
      !(certification.expiresAt instanceof Date) ||
      !Number.isFinite(certification.expiresAt.getTime()) ||
      certification.expiresAt.getTime() <= (input.now ?? new Date()).getTime() ||
      !/^[a-f0-9]{64}$/.test(certification.routeEvidenceDigest ?? "") ||
      !/^[a-f0-9]{64}$/.test(certification.checkoutEvidenceDigest ?? "") ||
      certification.pickupAddressId !== pickup.id) return false;
  try {
    return certification.pickupFingerprint === pickupCertificationFingerprint(pickup);
  } catch {
    return false;
  }
}
