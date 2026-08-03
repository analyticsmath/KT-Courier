import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient(); const threshold = new Date(Date.now() - 24 * 60 * 60_000);
const reference = () => `CRC-${randomUUID().replaceAll("-", "").toUpperCase()}`;
async function observe(tx, accrual, reason, summary) { const caseKey = `commission:${accrual.publicReference}:${reason}`; await tx.commissionReconciliationCase.upsert({ where: { caseKey }, create: { publicReference: reference(), caseKey, accrualId: accrual.id, reason, priority: "HIGH", safeSummary: summary }, update: { observationCount: { increment: 1 }, lastObservedAt: new Date(), status: "OPEN" } }); }
async function main() { const stale = await prisma.commissionAccrual.findMany({ where: { status: { in: ["ACCRUED", "RECONCILIATION_REQUIRED"] }, createdAt: { lt: threshold } }, select: { id: true, publicReference: true } }); await prisma.$transaction(async (tx) => { for (const accrual of stale) await observe(tx, accrual, "STALE_ACCRUAL", "Commission accrual remains unresolved beyond the reconciliation threshold."); }, { isolationLevel: "Serializable" }); console.log(`Commission reconciliation scan observed ${stale.length} stale accrual candidates.`); }
try { await main(); } catch (error) { console.error(error instanceof Error ? error.message : "Commission reconciliation scan failed."); process.exitCode = 1; }
finally { await prisma.$disconnect(); }
