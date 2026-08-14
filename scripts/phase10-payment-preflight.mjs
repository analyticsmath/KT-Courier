import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const count = (rows) => Number(rows[0]?.count ?? 0);

async function columnExists(table, column) {
  const rows = await prisma.$queryRaw`
    SELECT COUNT(*)::int AS count
    FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = ${table} AND column_name = ${column}
  `;
  return count(rows) === 1;
}

async function main() {
  const hasMerchantReference = await columnExists("PaymentAttempt", "merchantReference");
  const hasAttemptIdempotency = await columnExists("PaymentAttempt", "idempotencyKey");
  const [payments, attempts, refunds, webhooks, providers, currencies, invalidAmounts, duplicateReferences, duplicateOrders, duplicatePaymentKeys, successfulWithoutEvidence, terminalAttemptsMissingCompletion] = await Promise.all([
    prisma.$queryRaw`SELECT COUNT(*)::int AS count FROM "Payment"`,
    prisma.$queryRaw`SELECT COUNT(*)::int AS count FROM "PaymentAttempt"`,
    prisma.$queryRaw`SELECT COUNT(*)::int AS count FROM "PaymentRefund"`,
    prisma.$queryRaw`SELECT COUNT(*)::int AS count FROM "PaymentWebhookEvent"`,
    prisma.$queryRaw`SELECT "provider"::text AS provider, COUNT(*)::int AS count FROM "Payment" GROUP BY "provider" ORDER BY "provider"`,
    prisma.$queryRaw`SELECT "currency"::text AS currency, COUNT(*)::int AS count FROM "Payment" GROUP BY "currency" ORDER BY "currency"`,
    prisma.$queryRaw`SELECT COUNT(*)::int AS count FROM "Payment" WHERE "amount" <= 0 OR "currency"::text <> 'ZAR'`,
    prisma.$queryRaw`SELECT COUNT(*)::int AS count FROM (SELECT "paymentNumber" FROM "Payment" GROUP BY "paymentNumber" HAVING COUNT(*) > 1) duplicates`,
    prisma.$queryRaw`SELECT COUNT(*)::int AS count FROM (SELECT "orderId" FROM "Payment" WHERE "orderId" IS NOT NULL GROUP BY "orderId" HAVING COUNT(*) > 1) duplicates`,
    prisma.$queryRaw`SELECT COUNT(*)::int AS count FROM (SELECT "idempotencyKey" FROM "Payment" WHERE "idempotencyKey" IS NOT NULL GROUP BY "idempotencyKey" HAVING COUNT(*) > 1) duplicates`,
    prisma.$queryRaw`SELECT COUNT(*)::int AS count FROM "Payment" p WHERE p."status"::text IN ('PAID', 'SUCCEEDED') AND NOT EXISTS (SELECT 1 FROM "PaymentAttempt" a WHERE a."id"=p."successfulAttemptId" AND a."status"::text='SUCCEEDED' AND a."completedAt" IS NOT NULL)`,
    prisma.$queryRaw`SELECT COUNT(*)::int AS count FROM "PaymentAttempt" WHERE "status"::text IN ('SUCCEEDED','FAILED','CANCELLED','EXPIRED','UNKNOWN') AND "completedAt" IS NULL`,
  ]);
  const duplicateMerchantReferences = hasMerchantReference
    ? count(await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int AS count FROM (SELECT "merchantReference" FROM "PaymentAttempt" GROUP BY "merchantReference" HAVING COUNT(*) > 1) duplicates`))
    : 0;
  const duplicateAttemptKeys = hasAttemptIdempotency
    ? count(await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int AS count FROM (SELECT "idempotencyKey" FROM "PaymentAttempt" GROUP BY "idempotencyKey" HAVING COUNT(*) > 1) duplicates`))
    : 0;

  const summary = {
    payments: count(payments),
    attempts: count(attempts),
    refunds: count(refunds),
    webhooks: count(webhooks),
    invalidAmountsOrCurrencies: count(invalidAmounts),
    duplicatePublicReferences: count(duplicateReferences),
    duplicateOrderPayments: count(duplicateOrders),
    duplicatePaymentKeys: count(duplicatePaymentKeys),
    duplicateAttemptKeys,
    duplicateMerchantReferences,
    successfulWithoutEvidence: count(successfulWithoutEvidence),
    terminalAttemptsMissingCompletion: count(terminalAttemptsMissingCompletion),
  };
  console.log("Phase 10 payment preflight counts:", summary);
  console.log("Payment provider counts:", providers);
  console.log("Payment currency counts:", currencies);

  const blockers = [];
  if (summary.payments || summary.attempts || summary.refunds || summary.webhooks) console.log("CLASSIFIED: canonical post-Phase-10 payment evidence is present; runtime invariants are evaluated below.");
  if (summary.invalidAmountsOrCurrencies) blockers.push("non-ZAR or non-positive payment values exist");
  if (summary.duplicatePublicReferences || summary.duplicateOrderPayments || summary.duplicatePaymentKeys || duplicateAttemptKeys || duplicateMerchantReferences) blockers.push("duplicate payment identity or command keys exist");
  if (summary.successfulWithoutEvidence) blockers.push("successful payments lack verified attempt evidence");
  if (summary.terminalAttemptsMissingCompletion) blockers.push("terminal payment attempts lack completion evidence");
  if (blockers.length) throw new Error(`Phase 10 migration is unsafe: ${blockers.join("; ")}.`);
  console.log("Phase 10 payment preflight passed.");
}

try { await main(); } catch (error) {
  console.error(error instanceof Error ? error.message : "Phase 10 payment preflight failed.");
  process.exitCode = 1;
} finally { await prisma.$disconnect(); }
