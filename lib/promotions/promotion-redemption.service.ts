import { Prisma } from '@prisma/client';
import { createHash, randomUUID } from 'node:crypto';
import { Decimal } from '@prisma/client/runtime/library';
import { assertPromotionsProductionReady } from './production-lock';
import { recordBudgetMovement } from './promotion-budget.service';
import type { PromotionEvaluationResult } from './promotion-evaluation.service';
import type { LineAllocationEvidence } from './promotion-allocation-policy';
import { createPlatformSubsidyJournal, type PromotionJournalIntent } from './promotion-ledger-policy';
import { postLedgerJournalWithinTransaction } from '@/lib/services/ledger-posting.service';
import { lockBudgets, lockCampaignVersions } from './promotion-repositories';
import { ensureWalletForOwnerInTx, ensureLedgerAccountInTx } from '@/lib/services/wallet-account.service';
import { assertMarketplaceDigitalReceipt, marketplaceDigitalReceiptInclude } from '@/lib/marketplace-checkout/payment-funding';
import { PROMOTION_ACCOUNT_CODES } from '@/lib/promotions/promotion-ledger-policy';

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

const cuid = () => randomUUID();

async function getOrCreatePromotionLedgerAccounts(tx: PrismaTransactionClient) {
  // Use canonical ledger purposes, account codes and a single platform wallet.
  // Never create a second HELD-purpose account or allow negative customer
  // liabilities: doing so breaks the existing marketplace settlement ledger.
  const wallet = await ensureWalletForOwnerInTx(tx, {
    ownerType: 'PLATFORM', ownerId: 'platform', currency: 'ZAR',
  });
  const platformExpenseAccount = await ensureLedgerAccountInTx(tx, {
    walletId: wallet.id, code: PROMOTION_ACCOUNT_CODES.PLATFORM_EXPENSE,
    purpose: 'PLATFORM_PROMOTION_EXPENSE', category: 'EXPENSE', currency: 'ZAR',
  });
  const customerHeldAccount = await ensureLedgerAccountInTx(tx, {
    walletId: wallet.id, code: PROMOTION_ACCOUNT_CODES.CUSTOMER_FUNDS_HELD,
    purpose: 'HELD', category: 'LIABILITY', currency: 'ZAR',
  });
  return { platformExpenseAccount, customerHeldAccount };
}

export async function commitMarketplacePromotionRedemptions(input: RedemptionCommitInput, tx: PrismaTransactionClient): Promise<RedemptionCommitResult> {
  assertPromotionsProductionReady('COMMITMENT');

  if (input.paymentStatus !== 'SUCCEEDED') {
    throw new Error('Payment status must be SUCCEEDED');
  }
  if (input.reservationIds.length === 0
    || new Set(input.reservationIds).size !== input.reservationIds.length) {
    throw new Error('Promotion commitment requires distinct reservation evidence.');
  }

  // Never treat the caller's paymentStatus as proof of funds. Require the
  // canonical settled marketplace order, its accepted checkout fingerprint
  // and the provider-verified receipt with the matching held-funds ledger.
  const [checkout, marketplaceOrder, payment] = await Promise.all([
    tx.marketplaceCheckout.findUnique({ where: { id: input.checkoutId } }),
    tx.marketplaceOrder.findUnique({ where: { id: input.marketplaceOrderId } }),
    tx.payment.findUnique({
      where: { id: input.paymentId },
      include: marketplaceDigitalReceiptInclude,
    }),
  ]);
  if (!checkout || !marketplaceOrder || !payment
    || marketplaceOrder.checkoutId !== input.checkoutId
    || marketplaceOrder.paymentId !== input.paymentId
    || marketplaceOrder.status !== 'CONFIRMED'
    || marketplaceOrder.customerUserId !== checkout.customerUserId
    || checkout.reviewVersion !== input.checkoutReviewVersion
    || !checkout.acceptedFingerprint
    || checkout.acceptedFingerprint !== input.acknowledgementFingerprint
    || checkout.acceptedFingerprint !== marketplaceOrder.commercialFingerprint
    || !checkout.reviewAcceptedAt
    || payment.marketplaceCheckoutId !== input.checkoutId
    || (payment.marketplaceOrderId && payment.marketplaceOrderId !== input.marketplaceOrderId)
    || !marketplaceOrder.cashRequired.isZero()
    || !marketplaceOrder.digitalRequired.equals(checkout.digitalRequired ?? checkout.grandTotal)
    || !payment.amount.equals(marketplaceOrder.digitalRequired)) {
    throw new Error('Promotion commitment needs source-owned accepted checkout, order and digital funding evidence.');
  }
  assertMarketplaceDigitalReceipt(payment, marketplaceOrder.digitalRequired.toFixed(2));

  // 1. Idempotency Check
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`promotion-commit:${input.operationId}`},0))::text`;
  const existingRedemptions = await tx.promotionRedemption.findMany({
    where: { operationId: input.operationId }
  });

  if (existingRedemptions.length > 0) {
    if (existingRedemptions.length !== input.reservationIds.length
      || existingRedemptions.some(row =>
        row.requestHash !== input.requestHash
        || row.checkoutId !== input.checkoutId
        || row.marketplaceOrderId !== input.marketplaceOrderId
        || row.status !== 'COMMITTED'
        || !input.reservationIds.includes(row.reservationId)
      )) {
      throw new Error('Conflict: Promotion commitment replay does not match its financial source.');
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
  if (reservations.length !== input.frozenEvaluation.applied.length
    || reservations.some(row => {
      const approved = input.frozenEvaluation.applied.find(
        promotion => promotion.campaignVersionId === row.campaignVersionId,
      );
      return row.checkoutId !== input.checkoutId
        || row.checkoutReviewVersion !== input.checkoutReviewVersion
        || row.customerUserId !== marketplaceOrder.customerUserId
        || !approved
        || !new Decimal(row.reservedDiscountAmount).equals(approved.calculatedDiscount)
        || !new Decimal(row.reservedPlatformFunding).equals(approved.platformFunding)
        || !new Decimal(row.reservedStoreFunding).equals(approved.storeFunding);
    })) {
    throw new Error('Promotion reservations differ from the source-owned accepted checkout.');
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
  const sourceGroups = await tx.marketplaceCheckoutStoreGroup.findMany({ where: { checkoutId: input.checkoutId }, include: { lines: { where: { reviewVersion: input.checkoutReviewVersion }, select: { id: true, lineTotal: true } } } });

  for (const reservation of reservations) {
    // A verified payment may arrive after expiry, but it must have been
    // created while this reservation was valid. Expiry recovery retains any
    // reservation with a payment until that payment is reconciled.
    if (reservation.status !== 'RESERVED' || !payment.createdAt || reservation.createdAt > payment.createdAt || reservation.expiresAt <= payment.createdAt) {
      throw new Error(`Reservation ${reservation.id} is not active or is expired.`);
    }

    if (!Array.isArray(reservation.allocationEvidence) || !reservation.allocationEvidence.length) throw new Error('Promotion allocation evidence is unavailable.');
    let allocatedDiscount = new Decimal(0), allocatedPlatform = new Decimal(0), allocatedStore = new Decimal(0);
    const seenLines = new Set<string>();
    const frozenAllocations = reservation.allocationEvidence.map(item => {
      if (!item || typeof item !== 'object' || Array.isArray(item) || typeof item.lineReference !== 'string' || typeof item.storeGroupReference !== 'string' || !['MERCHANDISE', 'DELIVERY'].includes(String(item.allocationType)) || typeof item.basisAmount !== 'string' || typeof item.discountAmount !== 'string' || typeof item.platformFunding !== 'string' || typeof item.storeFunding !== 'string') throw new Error('Promotion allocation evidence is invalid.');
      const group = sourceGroups.find(candidate => candidate.id === item.storeGroupReference);
      const line = group?.lines.find(candidate => candidate.id === item.lineReference);
      const sourceBasis = item.allocationType === 'DELIVERY' && group && item.lineReference === `${group.storeId}_delivery` ? new Decimal(group.deliveryFee) : item.allocationType === 'MERCHANDISE' && line ? new Decimal(line.lineTotal) : null;
      const [basis, discount, platform, store] = [item.basisAmount, item.discountAmount, item.platformFunding, item.storeFunding].map(value => new Decimal(value as string));
      if (!sourceBasis || seenLines.has(item.lineReference) || [basis, discount, platform, store].some(value => !value.isFinite() || value.isNegative() || !value.toDecimalPlaces(2).equals(value)) || !basis.equals(sourceBasis) || discount.greaterThan(basis) || !platform.plus(store).equals(discount)) throw new Error('Promotion allocation evidence does not match its checkout source.');
      seenLines.add(item.lineReference);
      allocatedDiscount = allocatedDiscount.plus(discount); allocatedPlatform = allocatedPlatform.plus(platform); allocatedStore = allocatedStore.plus(store);
      return { lineReference: item.lineReference, storeGroupReference: item.storeGroupReference, allocationType: String(item.allocationType), eligibleBasis: basis, discountAmount: discount, platformFunding: platform, storeFunding: store };
    });
    if (!allocatedDiscount.equals(reservation.reservedDiscountAmount) || !allocatedPlatform.equals(reservation.reservedPlatformFunding) || !allocatedStore.equals(reservation.reservedStoreFunding)) throw new Error('Promotion allocation evidence does not reconcile.');

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
    await tx.promotionFinancialAllocation.createMany({ data: frozenAllocations.map(allocation => ({ ...allocation, publicReference: `PFA_${randomUUID()}`, redemptionId: record.id, calculationEvidence: { reservationReference: reservation.publicReference, checkoutReviewVersion: input.checkoutReviewVersion } })) });

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
        sourceReference: `PROMO:${createHash('sha256').update(record.id).digest('hex').toUpperCase()}`,
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
            discountAmount: record.discountAmount.toFixed(2),
            platformFunding: record.platformFunding.toFixed(2),
            storeFunding: record.storeFunding.toFixed(2),
            journalIntent: {
              journalType: intent.journalType,
              referenceId: intent.referenceId,
              lines: intent.lines.map((line) => ({
                accountCode: line.accountCode,
                lineCode: line.lineCode,
                amount: line.amount.toFixed(2),
                direction: line.direction,
              })),
            },
          },
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
