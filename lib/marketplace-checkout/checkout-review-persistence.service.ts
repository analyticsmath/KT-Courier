import { MarketplaceCheckoutError } from "@/lib/marketplace-checkout/errors";
import {
  acknowledgeMarketplaceCheckoutReview,
  revalidateMarketplaceCheckout,
  type MarketplaceCheckoutReviewResult,
  type ReviewGroup,
  type ReviewLine,
  type RevalidatedLine,
} from "@/lib/marketplace-checkout/checkout-review.service";
import type { MarketplaceDeliveryQuoteAdapter } from "@/lib/marketplace-checkout/marketplace-delivery-quote.service";
import type { PromotionEvaluationAdapter } from "@/lib/marketplace-checkout/checkout-review.service";
import type { FrozenMarketplaceStoreSettlementEvidence } from "@/lib/marketplace-checkout/frozen-seller-settlement-evidence.service";

type ReviewableCheckout = Readonly<{
  id: string;
  publicReference: string;
  status: string;
  version: number;
  reviewVersion: number;
  currency: string;
  grandTotal: string;
  commercialFingerprint: string | null;
  acceptedFingerprint: string | null;
  contactSnapshotId: string | null;
  addressSnapshotId: string | null;
  addressServiceAreaReference: string | null;
  settlementEvidenceVersions: readonly string[];
  groups: readonly ReviewGroup[];
  sourceGroups: readonly { id: string; storeId: string }[];
}>;

export type MarketplaceCheckoutReviewRepository = Readonly<{
  transaction<T>(work: () => Promise<T>): Promise<T>;
  lockCheckout(reference: string, owner: Readonly<{ type: "CUSTOMER"; userId: string } | { type: "GUEST"; guestTokenHash: string }>): Promise<ReviewableCheckout | null>;
  findOperation(checkoutId: string, operationId: string): Promise<{ requestHash: string; response: MarketplaceCheckoutReviewResult } | null>;
  freezeSettlementEvidence(input: Readonly<{ checkout: ReviewableCheckout; result: MarketplaceCheckoutReviewResult }>): Promise<Readonly<{ commercialFingerprint: string; evidence: readonly FrozenMarketplaceStoreSettlementEvidence[] }>>;
  persistReview(input: Readonly<{
    checkout: ReviewableCheckout;
    result: MarketplaceCheckoutReviewResult;
    operationId: string;
    requestHash: string;
    commissionPolicyVersion: string;
    settlementEvidence: readonly FrozenMarketplaceStoreSettlementEvidence[];
  }>): Promise<void>;
}>;

export async function reviewMarketplaceCheckout(
  repository: MarketplaceCheckoutReviewRepository,
  input: Readonly<{
    reference: string;
    owner: Readonly<{ type: "CUSTOMER"; userId: string } | { type: "GUEST"; guestTokenHash: string }>;
    operationId: string;
    requestHash: string;
    expectedVersion: number;
    commissionPolicyVersion: string;
    quoteAdapter: MarketplaceDeliveryQuoteAdapter;
    promotionAdapter?: PromotionEvaluationAdapter;
    resolveLine(line: ReviewLine): Promise<RevalidatedLine>;
  }>,
): Promise<MarketplaceCheckoutReviewResult> {
  return repository.transaction(async () => {
    const checkout = await repository.lockCheckout(input.reference, input.owner);
    if (!checkout) throw new MarketplaceCheckoutError("CHECKOUT_ACCESS_DENIED", "Checkout is unavailable.");
    const replay = await repository.findOperation(checkout.id, input.operationId);
    if (replay) {
      if (replay.requestHash !== input.requestHash) throw new MarketplaceCheckoutError("CHECKOUT_OPERATION_CONFLICT", "The operation ID was reused with different checkout meaning.");
      return replay.response;
    }
    if (checkout.version !== input.expectedVersion) throw new MarketplaceCheckoutError("CHECKOUT_VERSION_CONFLICT", "Checkout changed. Refresh and try again.");
    if (!["CREATED", "VALIDATING", "CHANGES_REQUIRED", "READY_FOR_REVIEW"].includes(checkout.status) || checkout.currency !== "ZAR" || !checkout.contactSnapshotId || !checkout.addressSnapshotId || !checkout.groups.length) {
      throw new MarketplaceCheckoutError("CHECKOUT_REVIEW_REQUIRED", "A complete mutable checkout is required for review.");
    }
    const reviewed = await revalidateMarketplaceCheckout({
      checkoutId: checkout.id,
      checkoutReference: checkout.publicReference,
      customerUserId: input.owner.type === "CUSTOMER" ? input.owner.userId : undefined,
      guestEvidenceReference: input.owner.type === "GUEST" ? input.owner.guestTokenHash : undefined,
      serviceAreaReference: checkout.addressServiceAreaReference,
      reviewVersion: checkout.reviewVersion + 1,
      groups: checkout.groups,
      resolveLine: input.resolveLine,
      quoteAdapter: input.quoteAdapter,
      promotionAdapter: input.promotionAdapter,
      commissionPolicyVersion: input.commissionPolicyVersion,
    });
    const frozen = await repository.freezeSettlementEvidence({ checkout, result: reviewed });
    const result = Object.freeze({ ...reviewed, commercialFingerprint: frozen.commercialFingerprint });
    await repository.persistReview({ checkout, result, settlementEvidence: frozen.evidence, operationId: input.operationId, requestHash: input.requestHash, commissionPolicyVersion: input.commissionPolicyVersion });
    return result;
  });
}

export type MarketplaceAcknowledgementRepository = Readonly<{
  transaction<T>(work: () => Promise<T>): Promise<T>;
  lockCheckout(reference: string, owner: Readonly<{ type: "CUSTOMER"; userId: string } | { type: "GUEST"; guestTokenHash: string }>): Promise<(ReviewableCheckout & { changes: readonly unknown[] }) | null>;
  findOperation(checkoutId: string, operationId: string): Promise<{ requestHash: string; response: { acknowledged: true; reviewVersion: number } } | null>;
  createAcknowledgement(input: Readonly<{
    checkoutId: string;
    reviewVersion: number;
    commercialFingerprint: string;
    acknowledgedTotalReference: string;
    termsVersion: string;
    privacyVersion: string;
    refundPolicyReferences: readonly string[];
    settlementEvidenceVersions: readonly string[];
    changes: readonly unknown[];
    operationId: string;
    requestHash: string;
  }>): Promise<void>;
}>;

export async function acknowledgeMarketplaceCheckoutReviewPersisted(
  repository: MarketplaceAcknowledgementRepository,
  input: Readonly<{
    reference: string;
    owner: Readonly<{ type: "CUSTOMER"; userId: string } | { type: "GUEST"; guestTokenHash: string }>;
    operationId: string;
    requestHash: string;
    expectedVersion: number;
    reviewVersion: number;
    commercialFingerprint: string;
    acknowledgedTotalReference: string;
    termsVersion: string;
    privacyVersion: string;
    refundPolicyReferences: readonly string[];
  }>,
): Promise<{ acknowledged: true; reviewVersion: number }> {
  return repository.transaction(async () => {
    const checkout = await repository.lockCheckout(input.reference, input.owner);
    if (!checkout) throw new MarketplaceCheckoutError("CHECKOUT_ACCESS_DENIED", "Checkout is unavailable.");
    const replay = await repository.findOperation(checkout.id, input.operationId);
    if (replay) {
      if (replay.requestHash !== input.requestHash) throw new MarketplaceCheckoutError("CHECKOUT_OPERATION_CONFLICT", "The operation ID was reused with different acknowledgement evidence.");
      return replay.response;
    }
    if (checkout.version !== input.expectedVersion || checkout.status !== "READY_FOR_REVIEW" || checkout.acceptedFingerprint) {
      throw new MarketplaceCheckoutError("CHECKOUT_CHANGES_UNACKNOWLEDGED", "Checkout review is stale or no longer acknowledgement-eligible.");
    }
    acknowledgeMarketplaceCheckoutReview({
      currentReviewVersion: checkout.reviewVersion,
      reviewVersion: input.reviewVersion,
      currentFingerprint: checkout.commercialFingerprint ?? "",
      commercialFingerprint: input.commercialFingerprint,
      currentGrandTotal: checkout.grandTotal,
      grandTotal: input.acknowledgedTotalReference,
      termsVersion: input.termsVersion,
      privacyVersion: input.privacyVersion,
      refundPolicyReferences: input.refundPolicyReferences,
      settlementEvidenceVersions: checkout.settlementEvidenceVersions,
    });
    await repository.createAcknowledgement({
      checkoutId: checkout.id,
      reviewVersion: input.reviewVersion,
      commercialFingerprint: input.commercialFingerprint,
      acknowledgedTotalReference: input.acknowledgedTotalReference,
      termsVersion: input.termsVersion,
      privacyVersion: input.privacyVersion,
      refundPolicyReferences: input.refundPolicyReferences,
      settlementEvidenceVersions: checkout.settlementEvidenceVersions,
      changes: checkout.changes,
      operationId: input.operationId,
      requestHash: input.requestHash,
    });
    return Object.freeze({ acknowledged: true as const, reviewVersion: input.reviewVersion });
  });
}
