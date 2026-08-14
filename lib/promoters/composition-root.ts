/* eslint-disable @typescript-eslint/no-explicit-any -- Prisma client generation is deferred to Phase 26.5. */
import { prisma } from "@/lib/db/prisma";
import { accrueCommissionInTransaction } from "@/lib/services/commission-accrual.service";
import { createWithdrawalRequest } from "@/lib/services/withdrawal-request.service";
import { ensureLedgerAccount, ensureWalletForOwner, getWalletAccount } from "@/lib/services/wallet-account.service";
import { createPrismaPromoterRepositories } from "./repositories";
import { PromoterLifecycleService } from "./lifecycle.service";
import * as qualificationEarning from "./qualification-earning.service";
import * as fraud from "./promoter-fraud.service";
import * as reconciliation from "./promoter-reconciliation.service";
import { PromoterProgrammeConfigService } from "./programme-config.service";
import { PromoterTeamQualificationService } from "./team-qualification.service";
import { assertPromotersProductionReady, PROMOTERS_PRODUCTION_BLOCK_REASON } from "./production-readiness";

/** Durable DB outbox: event intents are committed in the same transaction as the aggregate. */
class PrismaPromoterOutbox {
  constructor(private readonly db: any) {}
  append(input: { eventType: string; aggregateReference: string; operationId: string; safePayload?: object }) {
    return this.db.promoterEventIntent.create({ data: input });
  }
}

function concreteQualificationAdapters(db: any) {
  return Object.freeze({
    async courierOrder(orderId: string, customerUserId: string) { return db.order.findFirst({ where: { id: orderId, customerId: customerUserId, status: "COMPLETED", payment: { status: "SUCCEEDED" } }, select: { id: true, paymentId: true, completedAt: true } }); },
    async marketplaceOrder(orderId: string, customerUserId: string) { return db.marketplaceOrder.findFirst({ where: { id: orderId, customerUserId, status: "COMPLETED", payment: { status: "SUCCEEDED" } }, select: { id: true, paymentId: true, completedAt: true } }); },
    async businessOrder(orderId: string, businessAccountId: string) { void orderId; void businessAccountId; throw new Error("Business qualification is closed: the accepted schema has no canonical business-account authority."); },
    async storeSettlement(storeOrderId: string, storeId: string) { return db.marketplaceStoreOrder.findFirst({ where: { id: storeOrderId, storeId, status: "SETTLED" }, select: { id: true, settlementId: true, paymentId: true } }); },
  });
}

/**
 * Construction is deliberately complete before the non-overridable release gate.
 * No route or processor receives services until this resolves to LOCKED or READY.
 */
export function resolvePromoterProductionComposition() {
  const database: any = prisma;
  const repositories = createPrismaPromoterRepositories(database);
  const identity = Object.freeze({ findUser: (id: string) => database.user.findUnique({ where: { id }, select: { id: true } }) });
  const qualification = concreteQualificationAdapters(database);
  const finance = Object.freeze({ accrueCommissionInTransaction, ensureWalletForOwner, ensureLedgerAccount, getWalletAccount, requestWithdrawal: createWithdrawalRequest });
  const outbox = new PrismaPromoterOutbox(database);
  const services = Object.freeze({ lifecycle: new PromoterLifecycleService(database), qualificationEarning, fraud, reconciliation, programmeConfig: new PromoterProgrammeConfigService(database), teamQualification: new PromoterTeamQualificationService(database) });
  const composition = Object.freeze({ repositories, identity, qualification, finance, outbox, services });
  try { assertPromotersProductionReady(); return Object.freeze({ status: "READY" as const, ...composition }); }
  catch { return Object.freeze({ status: "LOCKED" as const, code: PROMOTERS_PRODUCTION_BLOCK_REASON, ...composition }); }
}
