import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const threshold = new Date(Date.now() - 15 * 60_000);
const reference = () => `RRC-${randomUUID().replaceAll("-", "").toUpperCase()}`;

async function observe(tx, input) {
  const caseKey = `refund:${input.refund.publicReference}:${input.reason}:${input.attempt?.publicReference ?? "none"}`;
  await tx.refundReconciliationCase.upsert({ where: { caseKey }, create: { publicReference: reference(), caseKey, refundId: input.refund.id, attemptId: input.attempt?.id, reason: input.reason, priority: "HIGH", safeSummary: input.summary }, update: { observationCount: { increment: 1 }, lastObservedAt: new Date(), status: "OPEN" } });
}

async function main() {
  const stale = await prisma.refundExecutionAttempt.findMany({ where: { status: "PROCESSING", updatedAt: { lt: threshold } }, select: { id: true, publicReference: true, refund: { select: { id: true, publicReference: true } } } });
  const unknown = await prisma.refundExecutionAttempt.findMany({ where: { status: "UNKNOWN" }, select: { id: true, publicReference: true, refund: { select: { id: true, publicReference: true } } } });
  await prisma.$transaction(async (tx) => {
    for (const attempt of stale) await observe(tx, { refund: attempt.refund, attempt, reason: "STALE_PROCESSING_ATTEMPT", summary: "Refund provider attempt remains processing beyond the reconciliation threshold." });
    for (const attempt of unknown) await observe(tx, { refund: attempt.refund, attempt, reason: "UNKNOWN_PROVIDER_OUTCOME", summary: "Refund provider outcome remains unknown and held funds must not be retried or released." });
  }, { isolationLevel: "Serializable" });
  console.log(`Refund reconciliation scan observed ${stale.length} stale and ${unknown.length} unknown attempts.`);
}
try { await main(); } catch (error) { console.error(error instanceof Error ? error.message : "Refund reconciliation scan failed."); process.exitCode = 1; }
finally { await prisma.$disconnect(); }

