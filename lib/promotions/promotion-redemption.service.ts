import { Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { assertPromotionsProductionReady } from './production-lock';
import { recordBudgetMovement } from './promotion-budget.service';
import type { PromotionEvaluationResult } from './promotion-evaluation.service';
import type { LineAllocationEvidence } from './promotion-allocation-policy';
import { createPlatformSubsidyJournal, type PromotionJournalIntent } from './promotion-ledger-policy';
import { postLedgerJournalWithinTransaction } from '@/lib/services/ledger-posting.service';
import { lockBudgets, lockCampaignVersions } from './promotion-repositories';

export interface RedemptionCommitInput {
  checkoutId: string;
  checkoutReviewVersion: number;
  acknowledgementFingerprint: string;
  paymentId: string;
  paymentStatus: string;
  marketplaceOrderId: string;
  reservationIds: string[];
  frozenEvaluation: PromotionEvaluationResult;
  operationId: string;
  requestHash: string;
  now: Date;
}

export interface RedemptionRecord {
  id: string;
  publicReference: string;
  campaignVersionId: string;
  promotionCodeId: string | null;
  reservationId: string;
  checkoutId: string;
  marketplaceOrderId: string;
  customerUserId: string | null;
  status: 'COMMITTED';
  discountAmount: Decimal;
  platformFunding: Decimal;
  storeFunding: Decimal;
  operationId: string;
}

export interface RedemptionCommitResult {
  redemptions: RedemptionRecord[];
  allocations: LineAllocationEvidence[];
  fundingIntents: PromotionJournalIntent[];
  operationId: string;
}

type PrismaTransactionClient = Parameters<Parameters<import('@prisma/client').PrismaClient['$transaction']>[0]>[0];

const cuid = () => Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

async function getOrCreatePromotionLedgerAccounts(tx: PrismaTransactionClient) {
  // Find or create platform wallet
  let platformWallet = await tx.wallet.findUnique({
    where: { ownerType_ownerId_currency: { ownerType: 'PLATFORM', ownerId: 'platform', currency: 'ZAR' } }
  });
  if (!platformWallet) {
    platformWallet = await tx.wallet.create({
      data: {
        ownerType: 'PLATFORM',
        ownerId: 'platform',
        currency: 'ZAR',
        status: 'ACTIVE'
      }
    });
  }

  // Ensure Platform Promotion Expense account exists
  let platformExpenseAccount = await tx.ledgerAccount.findFirst({
    where: { code: 'PLATFORM_PROMOTION_EXPENSE' }
  });
  if (!platformExpenseAccount) {
    platformExpenseAccount = await tx.ledgerAccount.create({
      data: {
        walletId: platformWallet.id,
        code: 'PLATFORM_PROMOTION_EXPENSE',
        purpose: 'AVAILABLE',
        category: 'EXPENSE',
        currency: 'ZAR',
        allowNegative: true
      }
    });
  }

  // Ensure Customer Funds Held account exists
  let customerHeldAccount = await tx.ledgerAccount.findFirst({
    where: { code: 'CUSTOMER_FUNDS_HELD' }
  });
  if (!customerHeldAccount) {
    customerHeldAccount = await tx.ledgerAccount.create({
      data: {
        walletId: platformWallet.id,
        code: 'CUSTOMER_FUNDS_HELD',
        purpose: 'HELD',
        category: 'LIABILITY',
        currency: 'ZAR',
        allowNegative: true
      }
    });
  }

  return { platformExpenseAccount, customerHeldAccount };
}

export async function commitMarketplacePromotionRedemptions(input: RedemptionCommitInput, tx: PrismaTransactionClient): Promise<RedemptionCommitResult> {
  assertPromotionsProductionReady('COMMITMENT');

  if (input.paymentStatus !== 'SUCCEEDED') {
    throw new Error('Payment status must be SUCCEEDED');
  }

  // 1. Idempotency Check
  const existingRedemptions = await tx.promotionRedemption.findMany({
    where: { operationId: input.operationId }
  });

  if (existingRedemptions.length > 0) {
    if (existingRedemptions[0].requestHash !== input.requestHash) {
      throw new Error(`Conflict: Replay of operation ${input.operationId} with different hash.`);
    }
    return {
      redemptions: existingRedemptions.map(r => ({
        id: r.id,
        publicReference: r.publicReference,
        campaignVersionId: r.campaignVersionId,
        promotionCodeId: r.promotionCodeId,
        reservationId: r.reservationId,
        checkoutId: r.checkoutId,
        marketplaceOrderId: r.marketplaceOrderId || '',
        customerUserId: r.customerUserId,
        status: 'COMMITTED',
        discountAmount: new Decimal(r.discountAmount),
        platformFunding: new Decimal(r.platformFunding),
        storeFunding: new Decimal(r.storeFunding),
        operationId: r.operationId,
      })),
      allocations: input.frozenEvaluation.allocations,
      fundingIntents: [],
      operationId: input.operationId,
    };
  }

  // 2. Lock Reservations in stable order
  const sortedResIds = [...new Set(input.reservationIds)].sort();
  await tx.$queryRaw`SELECT "id" FROM "PromotionReservation" WHERE "id" IN (${Prisma.join(sortedResIds)}) ORDER BY "id" ASC FOR UPDATE`;

  const reservations = await tx.promotionReservation.findMany({
    where: { id: { in: sortedResIds } }
  });

  if (reservations.length !== sortedResIds.length) {
    throw new Error('One or more reservations not found');
  }

  // Lock Campaign Versions in stable order
  const versionIds = reservations.map(r => r.campaignVersionId);
  await lockCampaignVersions(versionIds, tx);

  // Lock Budgets in stable order
  const budgets = await tx.promotionBudget.findMany({
    where: { campaignVersionId: { in: versionIds } }
  });
  await lockBudgets(budgets.map(b => b.id), tx);

  const redemptions: RedemptionRecord[] = [];
  const fundingIntents: PromotionJournalIntent[] = [];

  for (const reservation of reservations) {
    if (reservation.status !== 'RESERVED' || reservation.expiresAt < input.now) {
      throw new Error(`Reservation ${reservation.id} is not active or is expired.`);
    }

    const budget = budgets.find(b => b.campaignVersionId === reservation.campaignVersionId);
    if (!budget) {
      throw new Error(`Budget not found for campaign version ${reservation.campaignVersionId}`);
    }

    const redemptionId = cuid();
    const record: RedemptionRecord = {
      id: redemptionId,
      publicReference: cuid(),
      campaignVersionId: reservation.campaignVersionId,
      promotionCodeId: reservation.promotionCodeId,
      reservationId: reservation.id,
      checkoutId: input.checkoutId,
      marketplaceOrderId: input.marketplaceOrderId,
      customerUserId: reservation.customerUserId,
      status: 'COMMITTED',
      discountAmount: new Decimal(reservation.reservedDiscountAmount),
      platformFunding: new Decimal(reservation.reservedPlatformFunding),
      storeFunding: new Decimal(reservation.reservedStoreFunding),
      operationId: input.operationId,
    };

    // Create redemption record
    await tx.promotionRedemption.create({
      data: {
        id: record.id,
        publicReference: record.publicReference,
        campaignVersionId: record.campaignVersionId,
        promotionCodeId: record.promotionCodeId,
        reservationId: record.reservationId,
        checkoutId: record.checkoutId,
        marketplaceOrderId: record.marketplaceOrderId,
        customerUserId: record.customerUserId,
        status: record.status,
        discountAmount: record.discountAmount,
        platformFunding: record.platformFunding,
        storeFunding: record.storeFunding,
        operationId: record.operationId,
        requestHash: input.requestHash,
      }
    });

    // Update reservation status to COMMITTED
    await tx.promotionReservation.update({
      where: { id: reservation.id },
      data: { status: 'COMMITTED' }
    });

    // COMMIT Budget movement
    await recordBudgetMovement({
      budgetId: budget.id,
      campaignVersionId: reservation.campaignVersionId,
      movementType: 'COMMIT',
      amount: record.discountAmount,
      operationId: input.operationId + '_' + reservation.id,
      requestHash: input.requestHash,
      checkoutId: input.checkoutId,
      storeOrderId: input.marketplaceOrderId,
      redemptionId: record.id,
    }, tx);

    redemptions.push(record);

    // Platform Funding subsidy
    if (record.platformFunding.greaterThan(0)) {
      const intent = createPlatformSubsidyJournal(record.id, record.platformFunding);
      fundingIntents.push(intent);

      // Create durable ledger entry
      const { platformExpenseAccount, customerHeldAccount } = await getOrCreatePromotionLedgerAccounts(tx);
      await postLedgerJournalWithinTransaction(tx, {
        idempotencyKey: `LJ-PROMO-${record.id}`,
        type: 'GENERAL',
        currency: 'ZAR',
        sourceReference: record.id,
        correlationId: input.marketplaceOrderId,
        memo: `Platform Promotion Subsidy for redemption ${record.id}`,
        actor: { kind: 'SYSTEM' },
        entries: [
          {
            accountId: platformExpenseAccount.id,
            direction: 'DEBIT',
            amount: record.platformFunding.toFixed(2),
            lineCode: 'PLATFORM_PROMO_EXPENSE',
            memo: `Debit promotion expense`
          },
          {
            accountId: customerHeldAccount.id,
            direction: 'CREDIT',
            amount: record.platformFunding.toFixed(2),
            lineCode: 'CUSTOMER_FUNDS_PROMO_CREDIT',
            memo: `Credit customer funds held`
          }
        ]
      });

      // Write intent to the outbox table PromotionEventIntent
      await tx.promotionEventIntent.create({
        data: {
          eventType: 'PROMOTION_REDEMPTION_COMMITTED',
          payload: {
            redemptionId: record.id,
            checkoutId: input.checkoutId,
            marketplaceOrderId: input.marketplaceOrderId,
            discountAmount: record.discountAmount.toNumber(),
            platformFunding: record.platformFunding.toNumber(),
            storeFunding: record.storeFunding.toNumber(),
            journalIntent: intent
          } as any,
          dedupeKey: `redemption_committed_${record.id}`
        }
      });
    }
  }

  // Record operation receipt
  await tx.promotionOperation.create({
    data: {
      operationId: input.operationId,
      requestHash: input.requestHash,
      operationType: 'COMMITMENT',
      resultReference: redemptions.map(r => r.id).join(','),
    }
  });

  return {
    redemptions,
    allocations: input.frozenEvaluation.allocations,
    fundingIntents,
    operationId: input.operationId,
  };
}
