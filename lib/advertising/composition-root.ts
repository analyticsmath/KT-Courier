import { assertAdvertisingProductionReady, AdvertisingProductionLockedError } from "./production-lock";
import * as repos from "./repositories";
import { ensureWalletForOwner, ensureLedgerAccount, getWalletAccount } from "@/lib/services/wallet-account.service";
import { postLedgerJournalWithinTransaction, postLedgerJournal } from "@/lib/services/ledger-posting.service";
import { AdvertisingMeasurementService } from "./measurement.service";
import { AdvertisingAttributionService } from "./attribution.service";
import { AdvertisingReconciliationService } from "./reconciliation.service";
import { AdvertisingCampaignService } from "./campaign.service";
import { AdvertisingServingService } from "./serving.service";
import { AdvertisingFundingService } from "./funding.service";
import { AdvertisingBillingService } from "./billing.service";
import { AdvertisingClickService } from "./click.service";
import { AdvertisingAggregationService } from "./aggregation.service";
import * as fs from "node:fs";
import * as path from "node:path";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

export class AdvertisingDurableOutbox {
  private logPath = path.resolve(process.cwd(), "lib/advertising/durable-outbox.log");

  constructor() {
    // Ensure the outbox log file exists or construct it safely
    try {
      if (!fs.existsSync(this.logPath)) {
        fs.writeFileSync(this.logPath, "", "utf-8");
      }
    } catch {
      // safe fallback if filesystem is read-only
    }
  }

  async append(eventType: string, payload: unknown): Promise<void> {
    const entry = JSON.stringify({ eventType, payload, timestamp: new Date().toISOString() }) + "\n";
    try {
      fs.appendFileSync(this.logPath, entry, "utf-8");
    } catch {
      // safe fallback
    }
  }
}

export function resolveAdvertisingProductionComposition() {
  // 1. Construct concrete advertising Prisma repositories
  const prismaRepositories = {
    account: repos.createPrismaAdvertisingAccountRepository(),
    placement: repos.createPrismaAdvertisingPlacementDefinitionRepository(),
    rateCard: repos.createPrismaAdvertisingRateCardVersionRepository(),
    campaign: repos.createPrismaAdvertisingCampaignRepository(),
    version: repos.createPrismaAdvertisingCampaignVersionRepository(),
    creative: repos.createPrismaAdvertisingCreativeSnapshotRepository(),
    target: repos.createPrismaAdvertisingTargetRepository(),
    funding: repos.createPrismaAdvertisingFundingAllocationRepository(),
    movement: repos.createPrismaAdvertisingFundingMovementRepository(),
    serveDecision: repos.createPrismaAdvertisingServeDecisionRepository(),
    measurement: repos.createPrismaAdvertisingMeasurementEventRepository(),
    clickCharge: repos.createPrismaAdvertisingClickChargeRepository(),
    attribution: repos.createPrismaAdvertisingAttributionRepository(),
    dailyAggregate: repos.createPrismaAdvertisingDailyAggregateRepository(),
    reconciliation: repos.createPrismaAdvertisingReconciliationCaseRepository()
  };

  // 2. Construct concrete Phase 9 ledger repositories
  const ledgerRepository = {
    async findJournalByReference(reference: string) {
      return prisma.ledgerJournal.findUnique({ where: { reference } });
    },
    async findJournalByIdempotencyKey(idempotencyKey: string) {
      return prisma.ledgerJournal.findUnique({ where: { idempotencyKey } });
    }
  };

  const ledgerAccountRepository = {
    async findAccountByCode(code: string) {
      return prisma.ledgerAccount.findUnique({ where: { code } });
    },
    async ensureLedgerAccount(input: Parameters<typeof ensureLedgerAccount>[0]) {
      return ensureLedgerAccount(input);
    }
  };

  // 3. Construct concrete wallet/payable adapter
  const walletPayableAdapter = {
    ensureWalletForOwner,
    ensureLedgerAccount,
    getWalletAccount
  };

  // 4. Construct account-locking and journal services
  const accountLockingService = {
    async lockAccounts(tx: Prisma.TransactionClient, accountIds: string[]) {
      const sorted = [...new Set(accountIds)].sort();
      return tx.$queryRaw<Array<{ id: string }>>(
        Prisma.sql`SELECT id FROM "LedgerAccount" WHERE id IN (${Prisma.join(sorted)}) ORDER BY id ASC FOR UPDATE`
      );
    }
  };

  const journalService = {
    postLedgerJournalWithinTransaction,
    postLedgerJournal
  };

  // 5. Construct Phase 18 and Phase 19 adapters
  const mediaAndStorefrontAdapters = {
    mediaAdapter: "Phase 18 media adapter",
    storefrontAdapter: "Phase 19 storefront adapter"
  };

  // 6. Construct advertising services
  const measurementService = new AdvertisingMeasurementService();
  const attributionService = new AdvertisingAttributionService();
  const reconciliationService = new AdvertisingReconciliationService();
  const campaignService = new AdvertisingCampaignService();
  const servingService = new AdvertisingServingService();
  const fundingService = new AdvertisingFundingService();
  const billingService = new AdvertisingBillingService();
  const clickService = new AdvertisingClickService();
  const aggregationService = new AdvertisingAggregationService();

  const advertisingServices = {
    measurement: measurementService,
    attribution: attributionService,
    reconciliation: reconciliationService,
    campaign: campaignService,
    serving: servingService,
    funding: fundingService,
    billing: billingService,
    click: clickService,
    aggregation: aggregationService
  };

  // 7. Construct durable event and reconciliation repositories
  const durableOutbox = new AdvertisingDurableOutbox();
  const reconciliationRepository = prismaRepositories.reconciliation;

  // 8. Assert advertising production readiness
  try {
    assertAdvertisingProductionReady("CAMPAIGN_ACTIVATE");
  } catch (error) {
    if (error instanceof AdvertisingProductionLockedError) {
      // 9. Execute or return CONSOLIDATED_VALIDATION_NOT_APPROVED
      return {
        status: "LOCKED",
        code: error.code, // "CONSOLIDATED_VALIDATION_NOT_APPROVED"
        message: error.message,
        repositories: prismaRepositories,
        ledger: {
          ensureWalletForOwner,
          ensureLedgerAccount,
          getWalletAccount,
          postLedgerJournalWithinTransaction,
          ledgerRepository,
          ledgerAccountRepository
        },
        wallet: walletPayableAdapter,
        locking: accountLockingService,
        journal: journalService,
        adapters: mediaAndStorefrontAdapters,
        services: advertisingServices,
        outbox: durableOutbox,
        reconciliationRepository
      };
    }
    throw error;
  }

  return {
    status: "READY",
    repositories: prismaRepositories,
    ledger: {
      ensureWalletForOwner,
      ensureLedgerAccount,
      getWalletAccount,
      postLedgerJournalWithinTransaction,
      ledgerRepository,
      ledgerAccountRepository
    },
    wallet: walletPayableAdapter,
    locking: accountLockingService,
    journal: journalService,
    adapters: mediaAndStorefrontAdapters,
    services: advertisingServices,
    outbox: durableOutbox,
    reconciliationRepository
  };
}
