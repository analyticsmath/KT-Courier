import { evaluateMarketplacePromotions, type PromotionEvaluationInput } from './promotion-evaluation.service';
import { reserveCheckoutPromotions, type ReservationInput } from './promotion-reservation.service';
import { releaseCheckoutPromotions, type ReleaseInput } from './promotion-release.service';
import { commitMarketplacePromotionRedemptions, type RedemptionCommitInput } from './promotion-redemption.service';
import { applyPromotionRefundAdjustment, type PromotionRefundContext } from './promotion-refund.service';
import { assertPromotionsProductionReady } from './production-lock';
import { prisma } from '@/lib/db/prisma';

// Import concrete dependencies to ensure compilation and validation
import { getPlatformCommissionAccounts } from '@/lib/services/commission-account.service'; // Phase 14
import { ensureStoreEarningPayableAccount } from '@/lib/services/store-earning-account.service'; // Phase 16
import { resolveStoreOrderProductionComposition } from '@/lib/store-orders/composition-root'; // Phase 21
import { postLedgerJournalWithinTransaction } from '@/lib/services/ledger-posting.service'; // Ledger

export function resolvePromotionProductionComposition(operation: Parameters<typeof assertPromotionsProductionReady>[0]) {
  // 1. Resolve concrete dependencies
  const db = prisma;
  const checkoutRepository = prisma.marketplaceCheckout;
  const commissionAuthority = { getPlatformCommissionAccounts };
  const storeEarningAuthority = { ensureStoreEarningAccount: ensureStoreEarningPayableAccount };
  const adjustmentAuthority = resolveStoreOrderProductionComposition();
  const ledgerJournalService = { postLedgerJournalWithinTransaction };

  // 2. Construct canonical services
  const canonicalServices = {
    evaluate: async (input: PromotionEvaluationInput) => {
      assertPromotionsProductionReady('EVALUATION');
      const evaluatorDeps = {
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

            candidates.push({
              id: v.id,
              campaignId: v.campaignId,
              publicReference: v.publicReference,
              applicationMethod: v.applicationMethod,
              discountScope: v.discountScope,
              discountMechanism: v.discountMechanism,
              percentageValue: v.percentageValue,
              fixedAmount: v.fixedAmount,
              maximumDiscountAmount: v.maximumDiscountAmount,
              fundingType: v.fundingType as any,
              platformFundingShareBps: v.platformFundingShareBps,
              storeFundingShareBps: v.storeFundingShareBps,
              minimumEligibleSubtotal: v.minimumEligibleSubtotal,
              maximumRedemptionsGlobal: v.maximumRedemptionsGlobal,
              maximumRedemptionsPerCustomer: v.maximumRedemptionsPerCustomer,
              startsAt: v.startsAt,
              endsAt: v.endsAt,
              targets: v.targets.map(t => ({
                targetType: t.targetType,
                targetMode: t.targetMode,
                targetReference: t.targetReference,
              })),
              eligibilityRules: v.eligibility.map(e => ({
                rule: e.rule,
                ruleValue: e.ruleValue,
              })),
              currentGlobalRedemptions: globalRedemptionsCount,
              currentCustomerRedemptions: customerRedemptionsCount,
              customerFacingTitle: v.customerFacingTitle,
              campaignName: v.campaign.name,
            });
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

          return {
            id: v.id,
            campaignId: v.campaignId,
            publicReference: v.publicReference,
            applicationMethod: v.applicationMethod,
            discountScope: v.discountScope,
            discountMechanism: v.discountMechanism,
            percentageValue: v.percentageValue,
            fixedAmount: v.fixedAmount,
            maximumDiscountAmount: v.maximumDiscountAmount,
            fundingType: v.fundingType as any,
            platformFundingShareBps: v.platformFundingShareBps,
            storeFundingShareBps: v.storeFundingShareBps,
            minimumEligibleSubtotal: v.minimumEligibleSubtotal,
            maximumRedemptionsGlobal: v.maximumRedemptionsGlobal,
            maximumRedemptionsPerCustomer: v.maximumRedemptionsPerCustomer,
            startsAt: v.startsAt,
            endsAt: v.endsAt,
            targets: v.targets.map(t => ({
              targetType: t.targetType,
              targetMode: t.targetMode,
              targetReference: t.targetReference,
            })),
            eligibilityRules: v.eligibility.map(e => ({
              rule: e.rule,
              ruleValue: e.ruleValue,
            })),
            currentGlobalRedemptions: globalRedemptionsCount,
            currentCustomerRedemptions: customerRedemptionsCount,
            customerFacingTitle: v.customerFacingTitle,
            campaignName: v.campaign.name,
          };
        }
      };
      return evaluateMarketplacePromotions(input, evaluatorDeps as any);
    },
    reserve: async (input: ReservationInput, tx: any) => {
      assertPromotionsProductionReady('RESERVATION');
      return reserveCheckoutPromotions(input, tx);
    },
    release: async (input: ReleaseInput, tx: any) => {
      assertPromotionsProductionReady('RELEASE');
      return releaseCheckoutPromotions(input, tx);
    },
    commit: async (input: RedemptionCommitInput, tx: any) => {
      assertPromotionsProductionReady('COMMITMENT');
      return commitMarketplacePromotionRedemptions(input, tx);
    },
    refund: async (context: PromotionRefundContext, tx: any) => {
      assertPromotionsProductionReady('REVERSAL');
      return applyPromotionRefundAdjustment(context, tx);
    },
  };

  // 3. Assert promotion production readiness
  assertPromotionsProductionReady(operation);

  return canonicalServices;
}

export function createPromotionCompositionRoot(deps: any) {
  return {
    evaluate: (input: PromotionEvaluationInput) => evaluateMarketplacePromotions(input, deps.evaluator),
    reserve: (input: ReservationInput, tx: any) => reserveCheckoutPromotions(input, tx),
    release: (input: ReleaseInput, tx: any) => releaseCheckoutPromotions(input, tx),
    commit: (input: RedemptionCommitInput, tx: any) => commitMarketplacePromotionRedemptions(input, tx),
    refund: (context: PromotionRefundContext, tx: any) => applyPromotionRefundAdjustment(context, tx),
  };
}
