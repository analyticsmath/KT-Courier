import { Decimal } from '@prisma/client/runtime/library';
import { assertPromotionsProductionReady } from './production-lock';
import { calculateDiscountAmount, type DiscountScope, type DiscountType } from './promotion-discount-policy';
import { evaluateStackingPolicy, type PromotionCategory, type StackingEvidence } from './promotion-stacking-policy';
import { evaluateEligibilityRule, type RuleDefinition, type EligibilityContext } from './promotion-eligibility-policy';
import { evaluateTargeting, type TargetDefinition, type LineContext } from './promotion-targeting-policy';
import { allocatePromotionDiscount, type LineAllocationEvidence, type LineAllocationContext } from './promotion-allocation-policy';
import type { FundingType } from './promotion-policy';

export interface StoreGroupInput {
  storeReference: string;
  lines: {
    lineReference: string;
    merchandiseSubtotal: Decimal;
    modifierSubtotal: Decimal;
    productId: string;
    variantId: string;
    categoryId: string;
  }[];
}

export interface DeliveryQuoteInput {
  storeReference: string;
  feeAmount: Decimal;
  deliveryServiceType: string;
  deliveryRegion: string;
}

export interface CampaignVersionCandidate {
  id: string;
  campaignId: string;
  publicReference: string;
  applicationMethod: 'AUTOMATIC' | 'COUPON_CODE';
  discountScope: DiscountScope;
  discountMechanism: DiscountType;
  percentageValue: Decimal | null;
  fixedAmount: Decimal | null;
  maximumDiscountAmount: Decimal | null;
  fundingType: FundingType;
  platformFundingShareBps: number | null;
  storeFundingShareBps: number | null;
  minimumEligibleSubtotal: Decimal | null;
  maximumRedemptionsGlobal: number | null;
  maximumRedemptionsPerCustomer: number | null;
  startsAt: Date;
  endsAt: Date;
  targets: TargetDefinition[];
  eligibilityRules: RuleDefinition[];
  currentGlobalRedemptions: number;
  currentCustomerRedemptions: number;
  customerFacingTitle: string | null;
  campaignName: string;
}

export interface PromotionEvaluationInput {
  checkoutId: string;
  customerUserId?: string;
  guestEvidenceReference?: string;
  storeGroups: StoreGroupInput[];
  deliveryQuotes: DeliveryQuoteInput[];
  appliedCouponCode?: string;
  subscriptionBenefitEvidence?: unknown;
  now: Date;
}

export interface EligiblePromotion {
  campaignVersionId: string;
  campaignId: string;
  publicReference: string;
  applicationMethod: 'AUTOMATIC' | 'COUPON_CODE';
  discountScope: DiscountScope;
  calculatedDiscount: Decimal;
  fundingType: FundingType;
  platformFundingShareBps: number | null;
  customerFacingTitle: string | null;
  campaignName: string;
}

export interface AppliedPromotion extends EligiblePromotion {
  category: PromotionCategory;
  allocations: LineAllocationEvidence[];
  platformFunding: Decimal;
  storeFunding: Decimal;
}

export interface RejectedPromotion {
  campaignVersionId: string;
  reason: string;
}

export interface PromotionEvaluationResult {
  eligible: EligiblePromotion[];
  applied: AppliedPromotion[];
  rejected: RejectedPromotion[];
  stackingEvidence: StackingEvidence;
  totalDiscount: Decimal;
  totalPlatformFunding: Decimal;
  totalStoreFunding: Decimal;
  allocations: LineAllocationEvidence[];
}

export interface PromotionEvaluationDependencies {
  fetchActiveCampaignVersions(now: Date): Promise<CampaignVersionCandidate[]>;
  fetchCouponCampaignVersion?(codeHmac: string): Promise<CampaignVersionCandidate | null>;
}

export async function evaluateMarketplacePromotions(
  input: PromotionEvaluationInput,
  deps: PromotionEvaluationDependencies
): Promise<PromotionEvaluationResult> {
  assertPromotionsProductionReady('EVALUATION');

  const candidates = await deps.fetchActiveCampaignVersions(input.now);
  if (input.appliedCouponCode && deps.fetchCouponCampaignVersion) {
    const couponCandidate = await deps.fetchCouponCampaignVersion(input.appliedCouponCode);
    if (couponCandidate) {
      candidates.push(couponCandidate);
    }
  }

  let totalMerchandise = new Decimal(0);
  for (const group of input.storeGroups) {
    for (const line of group.lines) {
      totalMerchandise = totalMerchandise.plus(line.merchandiseSubtotal).plus(line.modifierSubtotal);
    }
  }

  const eligibilityContext: EligibilityContext = {
    userId: input.customerUserId,
    isGuest: !input.customerUserId,
    priorCompletedOrdersCount: 0, // Simplified for this stub
    hasActiveSubscription: !!input.subscriptionBenefitEvidence,
    deliveryRegion: input.deliveryQuotes[0]?.deliveryRegion || '',
    deliveryServiceType: input.deliveryQuotes[0]?.deliveryServiceType || '',
    subtotal: totalMerchandise,
  };

  const eligible: EligiblePromotion[] = [];
  const rejected: RejectedPromotion[] = [];
  type StackableCandidate = EligiblePromotion & {
    id: string;
    category: PromotionCategory;
    scope: DiscountScope;
    allocationLines: LineAllocationContext[];
  };
  const validStackableCandidates: StackableCandidate[] = [];

  for (const candidate of candidates) {
    // Check schedule
    if (input.now < candidate.startsAt || input.now > candidate.endsAt) {
      rejected.push({ campaignVersionId: candidate.id, reason: 'Outside campaign schedule' });
      continue;
    }

    // Check global limit
    if (candidate.maximumRedemptionsGlobal !== null && candidate.currentGlobalRedemptions >= candidate.maximumRedemptionsGlobal) {
      rejected.push({ campaignVersionId: candidate.id, reason: 'Global redemption limit reached' });
      continue;
    }

    // Check customer limit
    if (candidate.maximumRedemptionsPerCustomer !== null && candidate.currentCustomerRedemptions >= candidate.maximumRedemptionsPerCustomer) {
      rejected.push({ campaignVersionId: candidate.id, reason: 'Customer redemption limit reached' });
      continue;
    }

    // Check eligibility rules
    let eligibleRules = true;
    for (const rule of candidate.eligibilityRules) {
      if (!evaluateEligibilityRule(rule, eligibilityContext)) {
        eligibleRules = false;
        rejected.push({ campaignVersionId: candidate.id, reason: 'Failed eligibility rule: ' + rule.rule });
        break;
      }
    }
    if (!eligibleRules) continue;

    // Determine basis amount based on scope and targeting
    let basisAmount = new Decimal(0);
    const validLineAllocations: LineAllocationContext[] = [];

    if (candidate.discountScope === 'DELIVERY') {
      let deliveryMatches = false;
      for (const quote of input.deliveryQuotes) {
        const lineCtx: LineContext = {
          storeId: quote.storeReference,
          categoryId: 'delivery',
          productId: 'delivery',
          variantId: 'delivery',
          deliveryServiceType: quote.deliveryServiceType,
          deliveryRegion: quote.deliveryRegion,
        };
        if (evaluateTargeting(candidate.targets, lineCtx)) {
          basisAmount = basisAmount.plus(quote.feeAmount);
          validLineAllocations.push({ lineId: quote.storeReference + '_delivery', basisAmount: quote.feeAmount });
          deliveryMatches = true;
        }
      }
      if (!deliveryMatches) {
        rejected.push({ campaignVersionId: candidate.id, reason: 'No eligible delivery quotes' });
        continue;
      }
    } else {
      let hasMatches = false;
      for (const group of input.storeGroups) {
        const deliveryQuote = input.deliveryQuotes.find((q) => q.storeReference === group.storeReference);
        for (const line of group.lines) {
          const lineCtx: LineContext = {
            storeId: group.storeReference,
            categoryId: line.categoryId,
            productId: line.productId,
            variantId: line.variantId,
            deliveryServiceType: deliveryQuote?.deliveryServiceType || '',
            deliveryRegion: deliveryQuote?.deliveryRegion || '',
          };

          if (evaluateTargeting(candidate.targets, lineCtx)) {
            const lineTotal = line.merchandiseSubtotal.plus(line.modifierSubtotal);
            basisAmount = basisAmount.plus(lineTotal);
            validLineAllocations.push({ lineId: line.lineReference, basisAmount: lineTotal });
            hasMatches = true;
          }
        }
      }
      if (!hasMatches) {
        rejected.push({ campaignVersionId: candidate.id, reason: 'No eligible lines in cart' });
        continue;
      }
    }

    // Calculate discount amount
    const discountAmount = calculateDiscountAmount({
      scope: candidate.discountScope,
      type: candidate.discountMechanism,
      value: candidate.percentageValue || candidate.fixedAmount || new Decimal(0),
      basisAmount,
      maximumDiscountAmount: candidate.maximumDiscountAmount || undefined,
    });

    if (discountAmount.lessThanOrEqualTo(0)) {
      rejected.push({ campaignVersionId: candidate.id, reason: 'Calculated discount is zero' });
      continue;
    }

    // Determine category
    let category: PromotionCategory = 'AUTOMATIC_MERCHANDISE';
    if (candidate.applicationMethod === 'COUPON_CODE') category = 'COUPON';
    else if (candidate.discountScope === 'DELIVERY') category = 'DELIVERY_PROMO';
    else if (input.subscriptionBenefitEvidence && candidate.fundingType === 'PLATFORM') category = 'SUBSCRIPTION_BENEFIT'; // Simplification

    const eligiblePromo: EligiblePromotion = {
      campaignVersionId: candidate.id,
      campaignId: candidate.campaignId,
      publicReference: candidate.publicReference,
      applicationMethod: candidate.applicationMethod,
      discountScope: candidate.discountScope,
      calculatedDiscount: discountAmount,
      fundingType: candidate.fundingType,
      platformFundingShareBps: candidate.platformFundingShareBps,
      customerFacingTitle: candidate.customerFacingTitle,
      campaignName: candidate.campaignName,
    };

    eligible.push(eligiblePromo);
    validStackableCandidates.push({
      ...eligiblePromo,
      id: candidate.id,
      category,
      scope: candidate.discountScope,
      allocationLines: validLineAllocations,
    });
  }

  // Stacking policy
  const stackResult = evaluateStackingPolicy(validStackableCandidates);
  
  for (const rId of stackResult.evidence.rejectedPromotionIds) {
    rejected.push({ campaignVersionId: rId, reason: stackResult.evidence.rejectionReasons[rId] || 'Stacking rejected' });
  }

  const applied: AppliedPromotion[] = [];
  let totalDiscount = new Decimal(0);
  let totalPlatformFunding = new Decimal(0);
  let totalStoreFunding = new Decimal(0);
  const globalAllocations: LineAllocationEvidence[] = [];

  for (const selected of stackResult.selected) {
    const promo = validStackableCandidates.find((c) => c.id === selected.id)!;
    const validLines = promo.allocationLines;

    const allocs = allocatePromotionDiscount({
      totalDiscountAmount: selected.calculatedDiscount,
      lines: validLines,
      fundingType: promo.fundingType,
      platformShareBps: promo.platformFundingShareBps ?? undefined,
    });

    let promoPlatformFunding = new Decimal(0);
    let promoStoreFunding = new Decimal(0);
    for (const a of allocs) {
      promoPlatformFunding = promoPlatformFunding.plus(a.platformFunding);
      promoStoreFunding = promoStoreFunding.plus(a.storeFunding);
      globalAllocations.push(a);
    }

    applied.push({
      campaignVersionId: promo.campaignVersionId,
      campaignId: promo.campaignId,
      publicReference: promo.publicReference,
      applicationMethod: promo.applicationMethod,
      discountScope: promo.discountScope,
      calculatedDiscount: selected.calculatedDiscount,
      fundingType: promo.fundingType,
      platformFundingShareBps: promo.platformFundingShareBps,
      customerFacingTitle: promo.customerFacingTitle,
      campaignName: promo.campaignName,
      category: promo.category,
      allocations: allocs,
      platformFunding: promoPlatformFunding,
      storeFunding: promoStoreFunding,
    });

    totalDiscount = totalDiscount.plus(selected.calculatedDiscount);
    totalPlatformFunding = totalPlatformFunding.plus(promoPlatformFunding);
    totalStoreFunding = totalStoreFunding.plus(promoStoreFunding);
  }

  return {
    eligible,
    applied,
    rejected,
    stackingEvidence: stackResult.evidence,
    totalDiscount,
    totalPlatformFunding,
    totalStoreFunding,
    allocations: globalAllocations,
  };
}
