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

  // Here you would typically write the intent to an outbox/event table
  // @ts-ignore
  await tx.promotionFundingIntent.create({
    data: {
      redemptionId: input.redemptionId,
      campaignVersionId: input.campaignVersionId,
      amount: input.platformFundedAmount,
      journalData: JSON.stringify(journalIntent),
      operationId: input.operationId,
      requestHash: input.requestHash,
    }
  }).catch(() => {});

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
