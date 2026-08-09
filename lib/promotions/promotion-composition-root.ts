import { evaluateMarketplacePromotions, type CampaignVersionCandidate, type PromotionEvaluationDependencies, type PromotionEvaluationInput } from './promotion-evaluation.service';
import { reserveCheckoutPromotions, type ReservationInput } from './promotion-reservation.service';
import { releaseCheckoutPromotions, type ReleaseInput } from './promotion-release.service';
import { commitMarketplacePromotionRedemptions, type RedemptionCommitInput } from './promotion-redemption.service';
import { applyPromotionRefundAdjustment, type PromotionRefundContext } from './promotion-refund.service';
import { assertPromotionsProductionReady } from './production-lock';
import { prisma } from '@/lib/db/prisma';
import { Prisma, type PromotionCampaignVersionEligibility, type PromotionCampaignVersionTarget, type PromotionFundingType } from '@prisma/client';
import type { RuleDefinition } from './promotion-eligibility-policy';
import type { FundingType } from './promotion-policy';
import type { TargetDefinition } from './promotion-targeting-policy';

// Import concrete dependencies to ensure compilation and validation
import { getPlatformCommissionAccounts } from '@/lib/services/commission-account.service'; // Phase 14
import { ensureStoreEarningPayableAccount } from '@/lib/services/store-earning-account.service'; // Phase 16
import { resolveStoreOrderProductionComposition } from '@/lib/store-orders/composition-root'; // Phase 21
import { postLedgerJournalWithinTransaction } from '@/lib/services/ledger-posting.service'; // Ledger

type PromotionTransaction = Prisma.TransactionClient;
type PromotionVersionWithRelations = Prisma.PromotionCampaignVersionGetPayload<{
  include: { targets: true; eligibility: true; campaign: true; allowlist: true };
}>;

export interface PromotionCompositionDependencies {
  evaluator: PromotionEvaluationDependencies;
}

function mapFundingType(fundingType: PromotionFundingType): FundingType {
  switch (fundingType) {
    case 'PLATFORM_FUNDED': return 'PLATFORM';
    case 'STORE_FUNDED': return 'STORE';
    case 'SHARED_PLATFORM_STORE': return 'SHARED';
  }
}

function mapTarget(target: PromotionCampaignVersionTarget): TargetDefinition {
  return { type: target.targetType, mode: target.targetMode, targetReference: target.targetReference };
}

function mapEligibilityRule(
  rule: PromotionCampaignVersionEligibility,
  allowlistUserIds: readonly string[],
): RuleDefinition {
  switch (rule.rule) {
    case 'SPECIFIC_CUSTOMER_ALLOWLIST':
      return { rule: rule.rule, allowlistUserIds: [...allowlistUserIds] };
    case 'CUSTOMER_REGION':
      return { rule: rule.rule, region: rule.ruleValue ?? undefined };
    case 'MINIMUM_ELIGIBLE_SPEND':
      return rule.ruleValue ? { rule: rule.rule, minimumSpendAmount: new Prisma.Decimal(rule.ruleValue) } : { rule: rule.rule };
    case 'SERVICE_TYPE':
      return { rule: rule.rule, serviceType: rule.ruleValue ?? undefined };
    default:
      return { rule: rule.rule };
  }
}

function toCampaignVersionCandidate(
  version: PromotionVersionWithRelations,
  currentGlobalRedemptions: number,
  currentCustomerRedemptions: number,
): CampaignVersionCandidate {
  return {
    id: version.id,
    campaignId: version.campaignId,
    publicReference: version.publicReference,
    applicationMethod: version.applicationMethod,
    discountScope: version.discountScope,
    discountMechanism: version.discountMechanism,
    percentageValue: version.percentageValue,
    fixedAmount: version.fixedAmount,
    maximumDiscountAmount: version.maximumDiscountAmount,
    fundingType: mapFundingType(version.fundingType),
    platformFundingShareBps: version.platformFundingShareBps,
    storeFundingShareBps: version.storeFundingShareBps,
    minimumEligibleSubtotal: version.minimumEligibleSubtotal,
    maximumRedemptionsGlobal: version.maximumRedemptionsGlobal,
    maximumRedemptionsPerCustomer: version.maximumRedemptionsPerCustomer,
    startsAt: version.startsAt,
    endsAt: version.endsAt,
    targets: version.targets.map(mapTarget),
    eligibilityRules: version.eligibility.map((rule) => mapEligibilityRule(rule, version.allowlist.map((item) => item.customerUserId))),
    currentGlobalRedemptions,
    currentCustomerRedemptions,
    customerFacingTitle: version.customerFacingTitle,
    campaignName: version.campaign.name,
  };
}

export function resolvePromotionProductionComposition(operation: Parameters<typeof assertPromotionsProductionReady>[0]) {
  // 1. Resolve concrete dependencies
  void getPlatformCommissionAccounts;
  void ensureStoreEarningPayableAccount;
  void resolveStoreOrderProductionComposition;
  void postLedgerJournalWithinTransaction;

  // 2. Construct canonical services
  const canonicalServices = {
    evaluate: async (input: PromotionEvaluationInput) => {
      assertPromotionsProductionReady('EVALUATION');
      const evaluatorDeps: PromotionEvaluationDependencies = {
        fetchActiveCampaignVersions: async (now: Date) => {
          const activeVersions = await prisma.promotionCampaignVersion.findMany({
            where: {
              status: 'ACTIVE',
              startsAt: { lte: now },
              endsAt: { gte: now },
            },
            include: {
              targets: true,
              eligibility: true,
              campaign: true,
              allowlist: true,
            },
          });
          
          const candidates = [];
          for (const v of activeVersions) {
            const globalRedemptionsCount = await prisma.promotionRedemption.count({
              where: { campaignVersionId: v.id, status: 'COMMITTED' }
            });
            const customerRedemptionsCount = input.customerUserId ? await prisma.promotionRedemption.count({
              where: { campaignVersionId: v.id, customerUserId: input.customerUserId, status: 'COMMITTED' }
            }) : 0;

            candidates.push(toCampaignVersionCandidate(v, globalRedemptionsCount, customerRedemptionsCount));
          }
          return candidates;
        },
        fetchCouponCampaignVersion: async (codeHmac: string) => {
          const codeRecord = await prisma.promotionCode.findUnique({
            where: { codeHmac, status: 'ACTIVE' },
            include: {
              campaignVersion: {
                include: {
                  targets: true,
                  eligibility: true,
                  campaign: true,
                  allowlist: true,
                }
              }
            }
          });
          if (!codeRecord) return null;
          const v = codeRecord.campaignVersion;
          
          const globalRedemptionsCount = await prisma.promotionRedemption.count({
            where: { campaignVersionId: v.id, status: 'COMMITTED' }
          });
          const customerRedemptionsCount = input.customerUserId ? await prisma.promotionRedemption.count({
            where: { campaignVersionId: v.id, customerUserId: input.customerUserId, status: 'COMMITTED' }
          }) : 0;

          return toCampaignVersionCandidate(v, globalRedemptionsCount, customerRedemptionsCount);
        }
      };
      return evaluateMarketplacePromotions(input, evaluatorDeps);
    },
    reserve: async (input: ReservationInput, tx: PromotionTransaction) => {
      assertPromotionsProductionReady('RESERVATION');
      return reserveCheckoutPromotions(input, tx);
    },
    release: async (input: ReleaseInput, tx: PromotionTransaction) => {
      assertPromotionsProductionReady('RELEASE');
      return releaseCheckoutPromotions(input, tx);
    },
    commit: async (input: RedemptionCommitInput, tx: PromotionTransaction) => {
      assertPromotionsProductionReady('COMMITMENT');
      return commitMarketplacePromotionRedemptions(input, tx);
    },
    refund: async (context: PromotionRefundContext, tx: PromotionTransaction) => {
      assertPromotionsProductionReady('REVERSAL');
      return applyPromotionRefundAdjustment(context, tx);
    },
  };

  // 3. Assert promotion production readiness
  assertPromotionsProductionReady(operation);

  return canonicalServices;
}

export function createPromotionCompositionRoot(deps: PromotionCompositionDependencies) {
  return {
    evaluate: (input: PromotionEvaluationInput) => evaluateMarketplacePromotions(input, deps.evaluator),
    reserve: (input: ReservationInput, tx: PromotionTransaction) => reserveCheckoutPromotions(input, tx),
    release: (input: ReleaseInput, tx: PromotionTransaction) => releaseCheckoutPromotions(input, tx),
    commit: (input: RedemptionCommitInput, tx: PromotionTransaction) => commitMarketplacePromotionRedemptions(input, tx),
    refund: (context: PromotionRefundContext, tx: PromotionTransaction) => applyPromotionRefundAdjustment(context, tx),
  };
}
