import { prisma } from "@/lib/db/prisma";
import { Prisma, AdvertisingCampaignStatus, AdvertisingFundingStatus, AdvertisingFundingMovementType } from "@prisma/client";
import { ensureWalletForOwner, ensureLedgerAccount } from "@/lib/services/wallet-account.service";
import { postLedgerJournalWithinTransaction } from "@/lib/services/ledger-posting.service";
import { assertAdvertisingProductionReady } from "./production-lock";

export class AdvertisingFundingError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = "AdvertisingFundingError";
  }
}

export type FundCampaignInput = {
  campaignVersionId: string;
  storeId: string;
  amount: number;
  actorUserId: string;
  operationId: string;
  requestHash: string;
};

export type ReturnFundingInput = {
  campaignVersionId: string;
  storeId: string;
  actorUserId: string;
  operationId: string;
  requestHash: string;
};

export class AdvertisingFundingService {
  /** Provision platform held advertising account and platform revenue account */
  static async getPlatformAccounts() {
    const wallet = await ensureWalletForOwner({ ownerType: "PLATFORM", ownerId: "platform", currency: "ZAR" });
    const held = await ensureLedgerAccount({
      walletId: wallet.id,
      code: "PLATFORM-ADVERTISING-FUNDS-HELD-ZAR",
      purpose: "HELD",
      category: "LIABILITY",
      currency: "ZAR"
    });
    const revenue = await ensureLedgerAccount({
      walletId: wallet.id,
      code: "PLATFORM-ADVERTISING-REVENUE-ZAR",
      purpose: "PLATFORM_REVENUE",
      category: "REVENUE",
      currency: "ZAR"
    });
    return { wallet, held, revenue };
  }

  async fundAdvertisingCampaignFromStoreWallet(input: FundCampaignInput) {
    // 1. Authenticate the exact store billing actor.
    const store = await prisma.store.findUnique({
      where: { id: input.storeId },
      select: { ownerUserId: true }
    });
    if (!store) {
      throw new AdvertisingFundingError("STORE_NOT_FOUND", "Store was not found.");
    }

    // 2. Enforce explicit DENY
    const override = await prisma.userPermission.findFirst({
      where: { userId: input.actorUserId, permission: { key: "advertising.fund_own_store" } },
      select: { effect: true }
    });
    if (override?.effect === "DENY") {
      throw new AdvertisingFundingError("PERMISSION_DENIED", "Explicit DENY is active for store billing actor.");
    }

    // Ensure authorized: must be owner or have ALLOW
    const isOwner = store.ownerUserId === input.actorUserId;
    const isAllowed = override?.effect === "ALLOW";
    if (!isOwner && !isAllowed) {
      throw new AdvertisingFundingError("UNAUTHORIZED", "Actor is not authorized to fund this campaign.");
    }

    return this.fundCampaign(input);
  }

  async fundCampaign(input: FundCampaignInput) {
    // Check production ready
    assertAdvertisingProductionReady("CAMPAIGN_FUNDING");

    if (input.amount <= 0) {
      throw new AdvertisingFundingError("INVALID_AMOUNT", "Funding amount must be greater than zero.");
    }

    const { held: platformHeld } = await AdvertisingFundingService.getPlatformAccounts();

    return prisma.$transaction(async (tx) => {
      // 1. Lock campaign version and campaign
      const version = await tx.advertisingCampaignVersion.findUnique({
        where: { id: input.campaignVersionId },
        include: {
          campaign: true,
          rateCardVersion: true
        }
      });
      if (!version || version.campaign.storeId !== input.storeId) {
        throw new AdvertisingFundingError("CAMPAIGN_NOT_FOUND", "Campaign version not found or ownership mismatch.");
      }

      await tx.$queryRaw`SELECT id FROM "AdvertisingCampaign" WHERE id = ${version.campaignId} FOR UPDATE`;
      await tx.$queryRaw`SELECT id FROM "AdvertisingCampaignVersion" WHERE id = ${version.id} FOR UPDATE`;

      // Campaign must be APPROVED or FUNDING_REQUIRED or DRAFT
      if (
        version.campaign.status !== AdvertisingCampaignStatus.APPROVED &&
        version.campaign.status !== AdvertisingCampaignStatus.FUNDING_REQUIRED &&
        version.campaign.status !== AdvertisingCampaignStatus.DRAFT
      ) {
        throw new AdvertisingFundingError("INVALID_STATUS", "Campaign cannot be funded in its current state.");
      }

      // Check amount satisfies rate card minimum campaign funding
      const decAmount = new Prisma.Decimal(input.amount);
      if (decAmount.lt(version.rateCardVersion.minimumCampaignFunding)) {
        throw new AdvertisingFundingError(
          "MINIMUM_FUNDING_NOT_MET",
          `Funding amount must be at least ${version.rateCardVersion.minimumCampaignFunding.toFixed(2)} ZAR.`
        );
      }

      // 2. Lock store wallet & payable account
      const storeWallet = await tx.wallet.findUnique({
        where: { ownerType_ownerId_currency: { ownerType: "STORE", ownerId: input.storeId, currency: "ZAR" } }
      });
      if (!storeWallet || storeWallet.status !== "ACTIVE") {
        throw new AdvertisingFundingError("STORE_WALLET_INACTIVE", "Store wallet is inactive or missing.");
      }

      const storePayable = await tx.ledgerAccount.findFirst({
        where: { walletId: storeWallet.id, purpose: "STORE_EARNINGS_PAYABLE" }
      });
      if (!storePayable || storePayable.status !== "ACTIVE") {
        throw new AdvertisingFundingError("STORE_PAYABLE_INACTIVE", "Store earnings payable account is inactive or missing.");
      }

      // Lock store earnings payable
      await tx.$queryRaw`SELECT id FROM "LedgerAccount" WHERE id = ${storePayable.id} FOR UPDATE`;

      // Validate available funds
      if (storePayable.currentBalance.lt(decAmount)) {
        throw new AdvertisingFundingError("INSUFFICIENT_FUNDS", "Store payable balance is insufficient for campaign funding.");
      }

      // Check idempotency replay
      const existingAllocation = await tx.advertisingFundingAllocation.findFirst({
        where: { operationId: input.operationId }
      });
      if (existingAllocation) {
        if (existingAllocation.requestHash !== input.requestHash) {
          throw new AdvertisingFundingError("IDEMPOTENCY_CONFLICT", "Conflict on funding allocation request.");
        }
        return existingAllocation;
      }

      // 3. Post Ledger Journal
      // DEBIT store liability: STORE_EARNINGS_PAYABLE
      // CREDIT platform held funds: PLATFORM_ADVERTISING_FUNDS_HELD_ZAR
      const journal = await postLedgerJournalWithinTransaction(tx, {
        idempotencyKey: `AD-FUND-JRN-${input.operationId}`,
        type: "ACCOUNT_TRANSFER",
        currency: "ZAR",
        sourceReference: `AD-FUND-ALLOC-${input.operationId}`,
        memo: `Advertising Campaign Funding: ${version.campaign.name} (Ref: ${version.publicReference})`,
        actor: { kind: "USER", userId: input.actorUserId },
        entries: [
          {
            accountId: storePayable.id,
            direction: "DEBIT",
            amount: decAmount.toFixed(2),
            lineCode: "AD_FUND_DEBIT"
          },
          {
            accountId: platformHeld.id,
            direction: "CREDIT",
            amount: decAmount.toFixed(2),
            lineCode: "AD_FUND_CREDIT"
          }
        ]
      });

      // 4. Create Funding Allocation & Funding Movement
      const allocation = await tx.advertisingFundingAllocation.create({
        data: {
          publicReference: `AD-FUND-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
          campaignVersionId: version.id,
          storeId: input.storeId,
          status: AdvertisingFundingStatus.FUNDED,
          originalAmount: decAmount,
          remainingAmount: decAmount,
          spentAmount: new Prisma.Decimal(0),
          returnedAmount: new Prisma.Decimal(0),
          operationId: input.operationId,
          requestHash: input.requestHash,
          fundedAt: new Date()
        }
      });

      await tx.advertisingFundingMovement.create({
        data: {
          publicReference: `AD-MV-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
          fundingAllocationId: allocation.id,
          movementType: AdvertisingFundingMovementType.FUND,
          amount: decAmount,
          ledgerJournalId: journal.id,
          operationId: input.operationId,
          requestHash: input.requestHash
        }
      });

      // 5. Update Campaign Status
      await tx.advertisingCampaign.update({
        where: { id: version.campaignId },
        data: {
          status: AdvertisingCampaignStatus.FUNDED
        }
      });

      return allocation;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async returnUnusedAdvertisingFunding(input: ReturnFundingInput) {
    return this.returnUnusedFunding(input);
  }

  async returnUnusedFunding(input: ReturnFundingInput) {
    // Check production ready
    assertAdvertisingProductionReady("FUNDING_RETURN");

    const { held: platformHeld } = await AdvertisingFundingService.getPlatformAccounts();

    return prisma.$transaction(async (tx) => {
      // 1. Lock campaign version and campaign
      const version = await tx.advertisingCampaignVersion.findUnique({
        where: { id: input.campaignVersionId },
        include: {
          campaign: true,
          fundingAllocations: {
            where: { status: { in: [AdvertisingFundingStatus.FUNDED, AdvertisingFundingStatus.PARTIALLY_SPENT] } }
          }
        }
      });
      if (!version || version.campaign.storeId !== input.storeId) {
        throw new AdvertisingFundingError("CAMPAIGN_NOT_FOUND", "Campaign version not found or ownership mismatch.");
      }

      await tx.$queryRaw`SELECT id FROM "AdvertisingCampaign" WHERE id = ${version.campaignId} FOR UPDATE`;
      await tx.$queryRaw`SELECT id FROM "AdvertisingCampaignVersion" WHERE id = ${version.id} FOR UPDATE`;

      // Campaign must be ENDED, REJECTED, or SUSPENDED
      const allowed = [
        AdvertisingCampaignStatus.ENDED,
        AdvertisingCampaignStatus.REJECTED,
        AdvertisingCampaignStatus.SUSPENDED
      ];
      if (!allowed.includes(version.campaign.status as any)) {
        throw new AdvertisingFundingError("INVALID_STATUS", "Unused funding can only be returned for ended, rejected, or suspended campaigns.");
      }

      // Check if there are unresolved clicks (i.e. click charge in PENDING status)
      const pendingCharges = await tx.advertisingClickCharge.count({
        where: { campaignVersionId: version.id, status: "PENDING" }
      });
      if (pendingCharges > 0) {
        throw new AdvertisingFundingError("PENDING_CHARGES_EXIST", "Cannot return funding while unresolved click charges exist.");
      }

      // Check if there are unresolved reconciliation cases
      const unresolvedCases = await tx.advertisingReconciliationCase.count({
        where: { campaignVersionId: version.id, status: "OPEN" }
      });
      if (unresolvedCases > 0) {
        throw new AdvertisingFundingError("UNRESOLVED_RECONCILIATION_CASES_EXIST", "Cannot return funding while unresolved reconciliation cases exist.");
      }

      // Sum remaining balances
      let totalRemaining = new Prisma.Decimal(0);
      const allocationsToReturn = [];
      for (const alloc of version.fundingAllocations) {
        if (alloc.remainingAmount.gt(0)) {
          totalRemaining = totalRemaining.add(alloc.remainingAmount);
          allocationsToReturn.push(alloc);
        }
      }

      if (totalRemaining.isZero()) {
        throw new AdvertisingFundingError("NO_FUNDS_TO_RETURN", "No remaining funds available to return.");
      }

      // Lock store wallet & payable account
      const storeWallet = await tx.wallet.findUnique({
        where: { ownerType_ownerId_currency: { ownerType: "STORE", ownerId: input.storeId, currency: "ZAR" } }
      });
      if (!storeWallet || storeWallet.status !== "ACTIVE") {
        throw new AdvertisingFundingError("STORE_WALLET_INACTIVE", "Store wallet is inactive or missing.");
      }

      const storePayable = await tx.ledgerAccount.findFirst({
        where: { walletId: storeWallet.id, purpose: "STORE_EARNINGS_PAYABLE" }
      });
      if (!storePayable || storePayable.status !== "ACTIVE") {
        throw new AdvertisingFundingError("STORE_PAYABLE_INACTIVE", "Store earnings payable account is inactive or missing.");
      }

      await tx.$queryRaw`SELECT id FROM "LedgerAccount" WHERE id = ${storePayable.id} FOR UPDATE`;

      // Check idempotency
      const existingMovement = await tx.advertisingFundingMovement.findFirst({
        where: { operationId: input.operationId, movementType: AdvertisingFundingMovementType.UNUSED_RETURN }
      });
      if (existingMovement) {
        if (existingMovement.requestHash !== input.requestHash) {
          throw new AdvertisingFundingError("IDEMPOTENCY_CONFLICT", "Conflict on funding return request.");
        }
        return { returnedAmount: totalRemaining.toFixed(2) };
      }

      // Post Ledger Journal
      // DEBIT platform held funds: PLATFORM_ADVERTISING_FUNDS_HELD_ZAR
      // CREDIT store liability: STORE_EARNINGS_PAYABLE
      const journal = await postLedgerJournalWithinTransaction(tx, {
        idempotencyKey: `AD-RETURN-JRN-${input.operationId}`,
        type: "ACCOUNT_TRANSFER",
        currency: "ZAR",
        sourceReference: `AD-RETURN-${input.operationId}`,
        memo: `Advertising Campaign Funding Return: ${version.campaign.name} (Ref: ${version.publicReference})`,
        actor: { kind: "USER", userId: input.actorUserId },
        entries: [
          {
            accountId: platformHeld.id,
            direction: "DEBIT",
            amount: totalRemaining.toFixed(2),
            lineCode: "AD_RETURN_DEBIT"
          },
          {
            accountId: storePayable.id,
            direction: "CREDIT",
            amount: totalRemaining.toFixed(2),
            lineCode: "AD_RETURN_CREDIT"
          }
        ]
      });

      // Update allocations and create movements
      for (const alloc of allocationsToReturn) {
        await tx.advertisingFundingAllocation.update({
          where: { id: alloc.id },
          data: {
            returnedAmount: alloc.returnedAmount.add(alloc.remainingAmount),
            remainingAmount: new Prisma.Decimal(0),
            status: AdvertisingFundingStatus.RETURNED,
            returnedAt: new Date()
          }
        });

        await tx.advertisingFundingMovement.create({
          data: {
            publicReference: `AD-MV-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
            fundingAllocationId: alloc.id,
            movementType: AdvertisingFundingMovementType.UNUSED_RETURN,
            amount: alloc.remainingAmount,
            ledgerJournalId: journal.id,
            operationId: input.operationId,
            requestHash: input.requestHash
          }
        });
      }

      return { returnedAmount: totalRemaining.toFixed(2) };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }
}
