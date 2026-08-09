import { Decimal } from '@prisma/client/runtime/library';
import { assertPromotionsProductionReady } from './production-lock';
import { createPlatformSubsidyJournal, type PromotionJournalIntent } from './promotion-ledger-policy';
import type { LineAllocationEvidence } from './promotion-allocation-policy';

export interface PlatformFundingInput {
  redemptionId: string;
  campaignVersionId: string;
  platformFundedAmount: Decimal;
  paymentId: string;
  marketplaceOrderId: string;
  storeGroupReference?: string;
  allocations: LineAllocationEvidence[];
  operationId: string;
  requestHash: string;
}

export interface PlatformFundingResult {
  journalIntent: PromotionJournalIntent;
  operationId: string;
}

type PrismaTransactionClient = Parameters<Parameters<import('@prisma/client').PrismaClient['$transaction']>[0]>[0];

export async function fundPlatformPromotionInTransaction(input: PlatformFundingInput, tx: PrismaTransactionClient): Promise<PlatformFundingResult> {
  assertPromotionsProductionReady('FUNDING_JOURNAL');

  if (input.platformFundedAmount.lessThanOrEqualTo(0)) {
    throw new Error('Platform funded amount must be positive');
  }

  const journalIntent = createPlatformSubsidyJournal(input.redemptionId, input.platformFundedAmount);

  await tx.promotionEventIntent.upsert({
    where: { dedupeKey: `promotion_funding_${input.operationId}` },
    create: {
      eventType: "PROMOTION_FUNDING_INTENT",
      dedupeKey: `promotion_funding_${input.operationId}`,
      payload: {
        redemptionId: input.redemptionId,
        campaignVersionId: input.campaignVersionId,
        amount: input.platformFundedAmount.toFixed(2),
        paymentId: input.paymentId,
        marketplaceOrderId: input.marketplaceOrderId,
        requestHash: input.requestHash,
        journal: {
          journalType: journalIntent.journalType,
          referenceId: journalIntent.referenceId,
          lines: journalIntent.lines.map((line) => ({
            accountCode: line.accountCode,
            lineCode: line.lineCode,
            amount: line.amount.toFixed(2),
            direction: line.direction,
          })),
        },
      },
    },
    update: {},
  });

  return {
    journalIntent,
    operationId: input.operationId,
  };
}

export function calculatePlatformSubsidyEvidence(redemptionId: string, allocations: LineAllocationEvidence[]): PlatformFundingInput {
  let totalPlatformFunding = new Decimal(0);
  for (const a of allocations) {
    totalPlatformFunding = totalPlatformFunding.plus(a.platformFunding);
  }

  return {
    redemptionId,
    campaignVersionId: '', // To be filled by caller
    platformFundedAmount: totalPlatformFunding,
    paymentId: '', // To be filled by caller
    marketplaceOrderId: '', // To be filled by caller
    allocations,
    operationId: '', // To be filled by caller
    requestHash: '', // To be filled by caller
  };
}
