import { readFile } from "node:fs/promises";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const checks = [
  ["payment amounts are positive and ZAR", `SELECT COUNT(*)::int AS count FROM "Payment" WHERE "amount" <= 0 OR "currency"::text <> 'ZAR'`],
  ["public references are unique", `SELECT COUNT(*)::int AS count FROM (SELECT "paymentNumber" FROM "Payment" GROUP BY "paymentNumber" HAVING COUNT(*) > 1) d`],
  ["preparation keys are unique", `SELECT COUNT(*)::int AS count FROM (SELECT "idempotencyKey" FROM "Payment" GROUP BY "idempotencyKey" HAVING COUNT(*) > 1) d`],
  ["one courier-order payment exists per order", `SELECT COUNT(*)::int AS count FROM (SELECT "orderId" FROM "Payment" WHERE "subjectType"::text='COURIER_ORDER' AND "orderId" IS NOT NULL GROUP BY "orderId" HAVING COUNT(*) > 1) d`],
  ["attempt keys are unique", `SELECT COUNT(*)::int AS count FROM (SELECT "idempotencyKey" FROM "PaymentAttempt" GROUP BY "idempotencyKey" HAVING COUNT(*) > 1) d`],
  ["merchant references are unique", `SELECT COUNT(*)::int AS count FROM (SELECT "merchantReference" FROM "PaymentAttempt" GROUP BY "merchantReference" HAVING COUNT(*) > 1) d`],
  ["provider references are unique within provider", `SELECT COUNT(*)::int AS count FROM (SELECT "provider", "providerReference" FROM "PaymentAttempt" WHERE "providerReference" IS NOT NULL GROUP BY "provider", "providerReference" HAVING COUNT(*) > 1) d`],
  ["attempt numbers are positive, sequential, and unique", `SELECT COUNT(*)::int AS count FROM "Payment" p WHERE EXISTS (SELECT 1 FROM "PaymentAttempt" a WHERE a."paymentId" = p."id") AND (p."latestAttemptNumber" <> (SELECT COUNT(*) FROM "PaymentAttempt" a WHERE a."paymentId" = p."id") OR p."latestAttemptNumber" <> (SELECT MAX(a."attemptNumber") FROM "PaymentAttempt" a WHERE a."paymentId" = p."id"))`],
  ["attempt provider matches payment provider", `SELECT COUNT(*)::int AS count FROM "PaymentAttempt" a JOIN "Payment" p ON p."id" = a."paymentId" WHERE p."provider" IS NULL OR p."provider" <> a."provider"`],
  ["successful payments have successful attempt evidence", `SELECT COUNT(*)::int AS count FROM "Payment" p WHERE p."status"::text = 'SUCCEEDED' AND NOT EXISTS (SELECT 1 FROM "PaymentAttempt" a WHERE a."paymentId" = p."id" AND a."status"::text = 'SUCCEEDED')`],
  ["terminal payment timestamps are coherent", `SELECT COUNT(*)::int AS count FROM "Payment" WHERE ("status"::text = 'SUCCEEDED' AND "paidAt" IS NULL) OR ("status"::text = 'FAILED' AND "failedAt" IS NULL) OR ("status"::text = 'CANCELLED' AND "cancelledAt" IS NULL)`],
  ["attempt terminal timestamps are coherent", `SELECT COUNT(*)::int AS count FROM "PaymentAttempt" WHERE "status"::text IN ('SUCCEEDED','FAILED','CANCELLED','EXPIRED','UNKNOWN') AND "completedAt" IS NULL`],
  ["all attempts belong to a payment", `SELECT COUNT(*)::int AS count FROM "PaymentAttempt" a LEFT JOIN "Payment" p ON p."id" = a."paymentId" WHERE p."id" IS NULL`],
  ["all history belongs to a payment and matching attempt", `SELECT COUNT(*)::int AS count FROM "PaymentStatusHistory" h LEFT JOIN "Payment" p ON p."id" = h."paymentId" LEFT JOIN "PaymentAttempt" a ON a."id" = h."attemptId" WHERE p."id" IS NULL OR (h."attemptId" IS NOT NULL AND (a."id" IS NULL OR a."paymentId" <> h."paymentId"))`],
  ["snapshots contain no sensitive key names", `SELECT COUNT(*)::int AS count FROM "PaymentAttempt" WHERE COALESCE("requestSnapshot"::text, '') ~* '(secret|token|password|authorization|signature|merchant[_-]?key|private[_-]?key|cvv|bank[_-]?account|cookie)' OR COALESCE("providerPayload"::text, '') ~* '(secret|token|password|authorization|signature|merchant[_-]?key|private[_-]?key|cvv|bank[_-]?account|cookie)'`],
];

async function main() {
  const failures = [];
  for (const [name, sql] of checks) {
    const rows = await prisma.$queryRawUnsafe(sql);
    const failed = Number(rows[0]?.count ?? 0);
    console.log(`${failed ? "FAIL" : "PASS"}: ${name}${failed ? ` (${failed})` : ""}`);
    if (failed) failures.push(name);
  }

  const [preparation, session] = await Promise.all([
    readFile(new URL("../lib/services/payment-preparation.service.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/services/payment-provider-session.service.ts", import.meta.url), "utf8"),
  ]);
  const source = `${preparation}\n${session}`;
  const sourceChecks = [
    ["payment services do not invoke ledger posting", /postLedgerJournal|transferBetweenLedgerAccounts|reverseLedgerJournal|ledgerJournal\.(?:create|update)/],
    ["payment services do not mutate orders", /(?:tx|prisma)\.order\.(?:update|updateMany|delete|create)/],
    ["payment services do not process refunds/webhooks", /paymentRefund\.(?:create|update)|paymentWebhookEvent\.(?:create|update)/],
  ];
  for (const [name, pattern] of sourceChecks) {
    const failed = pattern.test(source);
    console.log(`${failed ? "FAIL" : "PASS"}: ${name}`);
    if (failed) failures.push(name);
  }
  if (failures.length) throw new Error(`Payment invariant verification failed: ${failures.join("; ")}.`);
  console.log("Payment invariant verification passed.");
}

try { await main(); } catch (error) {
  console.error(error instanceof Error ? error.message : "Payment invariant verification failed.");
  process.exitCode = 1;
} finally { await prisma.$disconnect(); }
