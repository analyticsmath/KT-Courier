import { prisma } from "@/lib/db/prisma";
import { Prisma, AdvertisingClickChargeStatus, AdvertisingFundingStatus, AdvertisingFundingMovementType, AdvertisingCampaignStatus } from "@prisma/client";
import { postLedgerJournalWithinTransaction } from "@/lib/services/ledger-posting.service";
import { AdvertisingFundingService } from "./funding.service";
import { assertAdvertisingProductionReady } from "./production-lock";

export class AdvertisingBillingError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = "AdvertisingBillingError";
  }
}

export type ChargeClickInput = {
  measurementEventId: string;
  sessionFingerprint: string;
  operationId: string;
  requestHash: string;
};

export type ReverseClickInput = {
  clickChargeId: string;
  reason: string;
  actorUserId: string;
  operationId: string;
  requestHash: string;
};

export class AdvertisingBillingService {
  constructor(private readonly tx?: Prisma.TransactionClient) {}

  private get db() {
    return this.tx || prisma;
  }

  async chargeValidAdvertisingClick(input: ChargeClickInput) {
    return this.chargeClick(input);
  }

  async chargeClick(input: ChargeClickInput) {
    // Check production ready
    assertAdvertisingProductionReady("CLICK_CHARGING");

    const { held: platformHeld, revenue: platformRevenue } = await AdvertisingFundingService.getPlatformAccounts();

    return prisma.$transaction(async (tx) => {
      // 1. Lock measurement event
      const event = await tx.advertisingMeasurementEvent.findUnique({
        where: { id: input.measurementEventId }
      });
      if (!event || event.eventType !== "CLICK") {
        throw new AdvertisingBillingError("EVENT_NOT_FOUND", "Measurement click event was not found.");
      }
      await tx.$queryRaw`SELECT id FROM "AdvertisingMeasurementEvent" WHERE id = ${event.id} FOR UPDATE`;

      // 2. Verify validity status is VALID
      if (event.validityStatus !== "VALID") {
        throw new AdvertisingBillingError("INVALID_MEASUREMENT_EVENT", "Only valid click events can be billed.");
      }

      // Check if already charged
      const existingCharge = await tx.advertisingClickCharge.findFirst({
        where: { measurementEventId: event.id }
      });
      if (existingCharge) {
        return existingCharge;
      }

      // Check if idempotency key exists
      const existingOp = await tx.advertisingClickCharge.findFirst({
        where: { operationId: input.operationId }
      });
      if (existingOp) {
        if (existingOp.requestHash !== input.requestHash) {
          throw new AdvertisingBillingError("IDEMPOTENCY_CONFLICT", "Conflict on click charge request.");
        }
        return existingOp;
      }

      // 3. Lock campaign version
      const version = await tx.advertisingCampaignVersion.findUnique({
        where: { id: event.campaignVersionId },
        include: {
          rateCardVersion: true,
          campaign: true
        }
      });
      if (!version) {
        throw new AdvertisingBillingError("CAMPAIGN_VERSION_NOT_FOUND", "Campaign version not found.");
      }
      await tx.$queryRaw`SELECT id FROM "AdvertisingCampaignVersion" WHERE id = ${version.id} FOR UPDATE`;

      const chargeAmount = version.rateCardVersion.costPerValidClick;

      // 4. Lock funding allocation
      const funding = await tx.advertisingFundingAllocation.findFirst({
        where: {
          campaignVersionId: version.id,
          status: { in: [AdvertisingFundingStatus.FUNDED, AdvertisingFundingStatus.PARTIALLY_SPENT] },
          remainingAmount: { gte: chargeAmount }
        }
      });
      if (!funding) {
        // If funding is unavailable, mark click non-billable, set campaign status to EXHAUSTED
        await tx.advertisingCampaign.update({
          where: { id: version.campaignId },
          data: { status: AdvertisingCampaignStatus.EXHAUSTED }
        });
        throw new AdvertisingBillingError("FUNDING_EXHAUSTED", "Campaign has run out of funds.");
      }
      await tx.$queryRaw`SELECT id FROM "AdvertisingFundingAllocation" WHERE id = ${funding.id} FOR UPDATE`;

      // 5. Verify daily and total budgets
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date();
      endOfDay.setHours(23, 59, 59, 999);

      const dailySpendResult = await tx.advertisingClickCharge.aggregate({
        where: {
          campaignVersionId: version.id,
          status: "CHARGED",
          chargedAt: { gte: startOfDay, lte: endOfDay }
        },
        _sum: { chargeAmount: true }
      });
      const dailySpend = dailySpendResult._sum.chargeAmount || new Prisma.Decimal(0);
      if (dailySpend.add(chargeAmount).gt(version.dailyBudget)) {
        throw new AdvertisingBillingError("DAILY_BUDGET_EXCEEDED", "Campaign daily budget limit reached.");
      }

      const totalSpendResult = await tx.advertisingClickCharge.aggregate({
        where: {
          campaignVersionId: version.id,
          status: "CHARGED"
        },
        _sum: { chargeAmount: true }
      });
      const totalSpend = totalSpendResult._sum.chargeAmount || new Prisma.Decimal(0);
      if (totalSpend.add(chargeAmount).gt(version.totalBudget)) {
        throw new AdvertisingBillingError("TOTAL_BUDGET_EXCEEDED", "Campaign total budget limit reached.");
      }

      // 6. Post Ledger Journal
      // DEBIT platform held: PLATFORM-ADVERTISING-FUNDS-HELD-ZAR
      // CREDIT platform revenue: PLATFORM-ADVERTISING-REVENUE-ZAR
      const journal = await postLedgerJournalWithinTransaction(tx, {
        idempotencyKey: `AD-CHG-JRN-${input.operationId}`,
        type: "ACCOUNT_TRANSFER",
        currency: "ZAR",
        sourceReference: `AD-CLICK-${event.publicReference}`,
        memo: `Advertising click charge for campaign: ${version.campaign.name}`,
        actor: { kind: "SYSTEM" },
        entries: [
          {
            accountId: platformHeld.id,
            direction: "DEBIT",
            amount: chargeAmount.toFixed(2),
            lineCode: "AD_CLICK_HELD_DEBIT"
          },
          {
            accountId: platformRevenue.id,
            direction: "CREDIT",
            amount: chargeAmount.toFixed(2),
            lineCode: "AD_CLICK_REV_CREDIT"
          }
        ]
      });

      // 7. Create unique click charge and funding movement
      const charge = await tx.advertisingClickCharge.create({
        data: {
          publicReference: `AD-CHG-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
          campaignVersionId: version.id,
          fundingAllocationId: funding.id,
          measurementEventId: event.id,
          status: AdvertisingClickChargeStatus.CHARGED,
          chargeAmount,
          rateCardVersionId: version.rateCardVersionId,
          ledgerJournalId: journal.id,
          operationId: input.operationId,
          requestHash: input.requestHash,
          chargedAt: new Date()
        }
      });

      await tx.advertisingFundingAllocation.update({
        where: { id: funding.id },
        data: {
          remainingAmount: funding.remainingAmount.sub(chargeAmount),
          spentAmount: funding.spentAmount.add(chargeAmount),
          status: funding.remainingAmount.sub(chargeAmount).isZero() ? AdvertisingFundingStatus.EXHAUSTED : AdvertisingFundingStatus.PARTIALLY_SPENT,
          exhaustedAt: funding.remainingAmount.sub(chargeAmount).isZero() ? new Date() : null
        }
      });

      await tx.advertisingFundingMovement.create({
        data: {
          publicReference: `AD-MV-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
          fundingAllocationId: funding.id,
          movementType: AdvertisingFundingMovementType.CHARGE,
          amount: chargeAmount,
          ledgerJournalId: journal.id,
          clickChargeId: charge.id,
          operationId: input.operationId,
          requestHash: input.requestHash
        }
      });

      // Update safe campaign spend aggregate in AdvertisingDailyAggregate
      await tx.advertisingDailyAggregate.upsert({
        where: {
          campaignVersionId_placementDefinitionId_date: {
            campaignVersionId: version.id,
            placementDefinitionId: version.placementDefinitionId,
            date: startOfDay
          }
        },
        create: {
          campaignVersionId: version.id,
          placementDefinitionId: version.placementDefinitionId,
          date: startOfDay,
          servedImpressions: 0,
          viewableImpressions: 0,
          clicks: 0,
          validClicks: 1,
          invalidClicks: 0,
          spend: chargeAmount,
          conversions: 0,
          attributedRevenue: new Prisma.Decimal(0),
          attributedUnits: 0
        },
        update: {
          validClicks: { increment: 1 },
          spend: { increment: chargeAmount }
        }
      });

      return charge;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async reverseInvalidAdvertisingClick(input: ReverseClickInput) {
    return this.reverseClick(input);
  }

  async reverseClick(input: ReverseClickInput) {
    // Check production ready
    assertAdvertisingProductionReady("INVALID_CLICK_REVERSAL");

    const { held: platformHeld, revenue: platformRevenue } = await AdvertisingFundingService.getPlatformAccounts();

    return prisma.$transaction(async (tx) => {
      // 1. Lock click charge
      const charge = await tx.advertisingClickCharge.findUnique({
        where: { id: input.clickChargeId }
      });
      if (!charge) {
        throw new AdvertisingBillingError("CHARGE_NOT_FOUND", "Click charge record was not found.");
      }
      await tx.$queryRaw`SELECT id FROM "AdvertisingClickCharge" WHERE id = ${charge.id} FOR UPDATE`;

      if (charge.status === AdvertisingClickChargeStatus.REVERSED) {
        throw new AdvertisingBillingError("ALREADY_REVERSED", "Click charge has already been reversed.");
      }

      // Lock funding allocation
      const funding = await tx.advertisingFundingAllocation.findUnique({
        where: { id: charge.fundingAllocationId }
      });
      if (!funding) {
        throw new AdvertisingBillingError("FUNDING_NOT_FOUND", "Funding allocation was not found.");
      }
      await tx.$queryRaw`SELECT id FROM "AdvertisingFundingAllocation" WHERE id = ${funding.id} FOR UPDATE`;

      // Check campaign version
      const version = await tx.advertisingCampaignVersion.findUnique({
        where: { id: charge.campaignVersionId }
      });
      if (!version) {
        throw new AdvertisingBillingError("CAMPAIGN_VERSION_NOT_FOUND", "Campaign version not found.");
      }

      // Check idempotency
      const existingOp = await tx.advertisingFundingMovement.findFirst({
        where: { operationId: input.operationId, movementType: AdvertisingFundingMovementType.INVALID_CLICK_REVERSAL }
      });
      if (existingOp) {
        if (existingOp.requestHash !== input.requestHash) {
          throw new AdvertisingBillingError("IDEMPOTENCY_CONFLICT", "Conflict on click reversal request.");
        }
        return { reversedAmount: charge.chargeAmount.toFixed(2) };
      }

      // 2. Post Ledger Journal
      // DEBIT platform revenue: PLATFORM-ADVERTISING-REVENUE-ZAR
      // CREDIT platform held: PLATFORM-ADVERTISING-FUNDS-HELD-ZAR
      const journal = await postLedgerJournalWithinTransaction(tx, {
        idempotencyKey: `AD-REV-JRN-${input.operationId}`,
        type: "ACCOUNT_TRANSFER",
        currency: "ZAR",
        sourceReference: `AD-REV-${charge.publicReference}`,
        memo: `Advertising click reversal: ${input.reason}`,
        actor: { kind: "USER", userId: input.actorUserId },
        entries: [
          {
            accountId: platformRevenue.id,
            direction: "DEBIT",
            amount: charge.chargeAmount.toFixed(2),
            lineCode: "AD_REV_REV_DEBIT"
          },
          {
            accountId: platformHeld.id,
            direction: "CREDIT",
            amount: charge.chargeAmount.toFixed(2),
            lineCode: "AD_REV_HELD_CREDIT"
          }
        ]
      });

      // Update click charge status and allocation
      await tx.advertisingClickCharge.update({
        where: { id: charge.id },
        data: {
          status: AdvertisingClickChargeStatus.REVERSED,
          reversedByJournalId: journal.id,
          reversedAt: new Date()
        }
      });

      await tx.advertisingFundingAllocation.update({
        where: { id: funding.id },
        data: {
          remainingAmount: funding.remainingAmount.add(charge.chargeAmount),
          spentAmount: funding.spentAmount.sub(charge.chargeAmount),
          status: AdvertisingFundingStatus.PARTIALLY_SPENT // returned to active pool
        }
      });

      await tx.advertisingFundingMovement.create({
        data: {
          publicReference: `AD-MV-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
          fundingAllocationId: funding.id,
          movementType: AdvertisingFundingMovementType.INVALID_CLICK_REVERSAL,
          amount: charge.chargeAmount,
          ledgerJournalId: journal.id,
          clickChargeId: charge.id,
          operationId: input.operationId,
          requestHash: input.requestHash
        }
      });

      // Adjust safe campaign spend aggregate in AdvertisingDailyAggregate
      const startOfDay = new Date(charge.chargedAt || new Date());
      startOfDay.setHours(0, 0, 0, 0);
      await tx.advertisingDailyAggregate.update({
        where: {
          campaignVersionId_placementDefinitionId_date: {
            campaignVersionId: charge.campaignVersionId,
            placementDefinitionId: version.placementDefinitionId,
            date: startOfDay
          }
        },
        data: {
          validClicks: { decrement: 1 },
          invalidClicks: { increment: 1 },
          spend: { decrement: charge.chargeAmount }
        }
      });

      return { reversedAmount: charge.chargeAmount.toFixed(2) };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }
}
