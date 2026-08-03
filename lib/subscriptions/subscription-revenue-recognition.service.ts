/* eslint-disable @typescript-eslint/no-explicit-any -- Prisma generation is intentionally deferred to Phase 26.5. */
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { SubscriptionError } from "@/lib/subscriptions/errors";
import { postLedgerJournalWithinTransaction } from "@/lib/services/ledger-posting.service";
import { subscriptionRevenueRecognitionPosting } from "@/lib/subscriptions/subscription-ledger-policy";

const db = prisma as any;
const dayMs = 86_400_000;
const dayStart = (value: Date) => new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));

export function calculateSubscriptionRevenueRecognition(input: Readonly<{ netAmount: string; recognizedAmount: string; serviceStart: Date; serviceEnd: Date; through: Date }>) {
  const start = dayStart(input.serviceStart).getTime(); const end = dayStart(input.serviceEnd).getTime(); const targetDate = dayStart(input.through).getTime();
  const totalDays = Math.ceil((end - start) / dayMs);
  if (totalDays <= 0) throw new SubscriptionError("SUBSCRIPTION_RECONCILIATION_REQUIRED", "Subscription revenue schedule has no valid service period.");
  const earnedDays = Math.min(totalDays, Math.max(0, Math.floor((targetDate - start) / dayMs) + 1));
  const total = new Prisma.Decimal(input.netAmount); const prior = new Prisma.Decimal(input.recognizedAmount);
  const cumulative = total.mul(earnedDays).div(totalDays).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
  const delta = Prisma.Decimal.max(new Prisma.Decimal(0), cumulative.minus(prior)).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
  return Object.freeze({ recognitionDate: new Date(targetDate), totalDays, earnedDays, cumulativeAmount: cumulative.toFixed(2), amount: delta.toFixed(2), complete: cumulative.equals(total) });
}

export type SubscriptionRevenueRecognitionRepository = Readonly<{
  recognize(input: Readonly<{ scheduleReference: string; through: Date; operationId: string }>): Promise<Readonly<{ outcome: "RECOGNIZED" | "NOT_DUE" | "DUPLICATE" | "RECONCILIATION_REQUIRED"; amount?: string; cumulativeAmount?: string }>>;
}>;

export async function recognizeSubscriptionRevenue(repository: SubscriptionRevenueRecognitionRepository, input: Readonly<{ scheduleReference: string; through: Date; operationId: string }>) {
  return repository.recognize(input);
}

const safe = (prefix: string, value: string) => `${prefix}_${value.replace(/[^A-Za-z0-9_-]/g, "").slice(-36)}`;

export function createPrismaSubscriptionRevenueRecognitionRepository(database: any = db): SubscriptionRevenueRecognitionRepository {
  return Object.freeze({
    async recognize(input) {
      return database.$transaction(async (tx: any) => {
        await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "SubscriptionRevenueRecognitionSchedule" WHERE "publicReference" = ${input.scheduleReference} FOR UPDATE`);
        const schedule = await tx.subscriptionRevenueRecognitionSchedule.findUnique({ where: { publicReference: input.scheduleReference }, include: { invoice: true } });
        if (!schedule || schedule.status === "RECONCILIATION_REQUIRED" || schedule.status === "REVERSED") return { outcome: "RECONCILIATION_REQUIRED" as const };
        const result = calculateSubscriptionRevenueRecognition({ netAmount: schedule.netAmount.toFixed(2), recognizedAmount: schedule.recognizedAmount.toFixed(2), serviceStart: schedule.serviceStart, serviceEnd: schedule.serviceEnd, through: input.through });
        if (result.amount === "0.00") return { outcome: schedule.recognizedAmount.equals(new Prisma.Decimal(result.cumulativeAmount)) ? "DUPLICATE" as const : "NOT_DUE" as const };
        const existing = await tx.subscriptionRevenueRecognitionEntry.findUnique({ where: { scheduleId_recognitionDate: { scheduleId: schedule.id, recognitionDate: result.recognitionDate } } });
        if (existing) return { outcome: "DUPLICATE" as const, amount: existing.amount.toFixed(2), cumulativeAmount: existing.cumulativeAmount.toFixed(2) };
        const accounts = await tx.ledgerAccount.findMany({ where: { wallet: { ownerType: "PLATFORM", ownerId: "platform", currency: "ZAR", status: "ACTIVE" }, code: { in: ["PLATFORM-SUBSCRIPTION-DEFERRED-REVENUE-ZAR", "PLATFORM-SUBSCRIPTION-REVENUE-ZAR"] }, currency: "ZAR", status: "ACTIVE" }, select: { id: true, code: true, purpose: true, category: true } });
        const deferred = accounts.find((account: any) => account.code === "PLATFORM-SUBSCRIPTION-DEFERRED-REVENUE-ZAR" && account.purpose === "SUBSCRIPTION_DEFERRED_REVENUE" && account.category === "LIABILITY");
        const revenue = accounts.find((account: any) => account.code === "PLATFORM-SUBSCRIPTION-REVENUE-ZAR" && account.purpose === "PLATFORM_REVENUE" && account.category === "REVENUE");
        if (!deferred || !revenue) return { outcome: "RECONCILIATION_REQUIRED" as const };
        const journal = await postLedgerJournalWithinTransaction(tx, subscriptionRevenueRecognitionPosting({ invoiceReference: schedule.invoice.publicReference, scheduleReference: schedule.publicReference, recognitionDate: result.recognitionDate.toISOString().slice(0, 10), amount: result.amount, deferredRevenueAccountId: deferred.id, subscriptionRevenueAccountId: revenue.id }));
        await tx.subscriptionRevenueRecognitionEntry.create({ data: { publicReference: safe("subreventry", `${schedule.id}_${result.recognitionDate.toISOString()}`), scheduleId: schedule.id, recognitionDate: result.recognitionDate, amount: result.amount, cumulativeAmount: result.cumulativeAmount, ledgerJournalId: journal.id, operationId: input.operationId, safeEvidence: { journalReference: journal.reference, policyVersion: "subscription-revenue-straight-line-v1" } } });
        await tx.subscriptionRevenueRecognitionSchedule.update({ where: { id: schedule.id }, data: { recognizedAmount: result.cumulativeAmount, status: result.complete ? "COMPLETED" : "ACTIVE" } });
        return { outcome: "RECOGNIZED" as const, amount: result.amount, cumulativeAmount: result.cumulativeAmount };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    },
  });
}
