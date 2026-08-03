import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient(); const threshold = new Date(Date.now() - 30 * 60_000);
const reference = () => `WRC-${randomUUID().replaceAll("-", "").toUpperCase()}`;

async function observe(tx, withdrawal, attempt, reason, summary) {
  const caseKey = `withdrawal:${withdrawal.publicReference}:${reason}:${attempt?.publicReference ?? "none"}`;
  await tx.withdrawalReconciliationCase.upsert({ where: { caseKey }, create: { publicReference: reference(), caseKey, withdrawalId: withdrawal.id, payoutAttemptId: attempt?.id, reason, priority: "HIGH", safeSummary: summary }, update: { lastObservedAt: new Date(), observationCount: { increment: 1 } } });
}
async function main() {
  const stale = await prisma.withdrawalPayoutAttempt.findMany({ where: { status: { in: ["PROCESSING", "UNKNOWN"] }, updatedAt: { lt: threshold } }, include: { withdrawal: { select: { id: true, publicReference: true, status: true } } } });
  await prisma.$transaction(async (tx) => { for (const attempt of stale) await observe(tx, attempt.withdrawal, attempt, attempt.status === "UNKNOWN" ? "UNKNOWN_PAYOUT_OUTCOME" : "STALE_PROCESSING_ATTEMPT", `Withdrawal payout attempt remains ${attempt.status.toLowerCase()} beyond the reconciliation threshold.`); }, { isolationLevel: "Serializable" });
  console.log(`Withdrawal reconciliation scan observed ${stale.length} stale payout attempt candidates.`);
}
try { await main(); } catch (error) { console.error(error instanceof Error ? error.message : "Withdrawal reconciliation scan failed."); process.exitCode = 1; }
finally { await prisma.$disconnect(); }
