import { readFile } from "node:fs/promises";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const checks = [
  ["Payfast attempts use PAYFAST", `SELECT COUNT(*)::int AS count FROM "PaymentAttempt" WHERE "provider"::text <> 'PAYFAST'`],
  ["Payfast merchant references are unique", `SELECT COUNT(*)::int AS count FROM (SELECT "merchantReference" FROM "PaymentAttempt" WHERE "provider"::text = 'PAYFAST' GROUP BY "merchantReference" HAVING COUNT(*) > 1) d`],
  ["Payfast merchant references fit the provider limit", `SELECT COUNT(*)::int AS count FROM "PaymentAttempt" WHERE "provider"::text = 'PAYFAST' AND length("merchantReference") > 100`],
  ["attempt counters remain coherent", `SELECT COUNT(*)::int AS count FROM "Payment" p WHERE EXISTS (SELECT 1 FROM "PaymentAttempt" a WHERE a."paymentId" = p."id") AND p."latestAttemptNumber" <> (SELECT MAX(a."attemptNumber") FROM "PaymentAttempt" a WHERE a."paymentId" = p."id")`],
  ["Payfast attempts carry environment audit", `SELECT COUNT(*)::int AS count FROM "PaymentAttempt" WHERE "provider"::text = 'PAYFAST' AND "providerEnvironment" IS NULL`],
  ["Payfast actionable attempts use FORM_POST", `SELECT COUNT(*)::int AS count FROM "PaymentAttempt" WHERE "provider"::text = 'PAYFAST' AND "status"::text = 'REQUIRES_ACTION' AND "checkoutActionType"::text <> 'FORM_POST'`],
  ["FORM_POST never persists redirect URLs", `SELECT COUNT(*)::int AS count FROM "PaymentAttempt" WHERE "checkoutActionType"::text = 'FORM_POST' AND "redirectUrl" IS NOT NULL`],
  ["snapshots contain no Payfast secrets, signatures, or raw forms", `SELECT COUNT(*)::int AS count FROM "PaymentAttempt" WHERE COALESCE("requestSnapshot"::text, '') ~* '(merchant[_-]?key|passphrase|signature|email_address|merchant_id.*merchant_key.*return_url)' OR COALESCE("providerPayload"::text, '') ~* '(merchant[_-]?key|passphrase|signature|email_address|merchant_id.*merchant_key.*return_url)'`],
  ["amount remains server-authoritative positive ZAR", `SELECT COUNT(*)::int AS count FROM "Payment" p JOIN "Order" o ON o."id" = p."orderId" LEFT JOIN "PricingQuote" q ON q."id" = o."pricingQuoteId" WHERE p."provider"::text = 'PAYFAST' AND (p."amount" <= 0 OR p."currency"::text <> 'ZAR' OR q."id" IS NULL OR q."currency" <> 'ZAR' OR p."amount" <> q."total")`],
  ["browser return did not establish Payfast success", `SELECT COUNT(*)::int AS count FROM "PaymentAttempt" WHERE "provider"::text = 'PAYFAST' AND "status"::text = 'SUCCEEDED'`],
  ["browser cancellation did not establish definite cancellation", `SELECT COUNT(*)::int AS count FROM "PaymentAttempt" WHERE "provider"::text = 'PAYFAST' AND "status"::text = 'CANCELLED'`],
  ["Phase 11 processed no ITN", `SELECT COUNT(*)::int AS count FROM "PaymentWebhookEvent" WHERE "provider"::text = 'PAYFAST'`],
  ["no Payfast payment or attempt reference reached a ledger journal", `SELECT COUNT(*)::int AS count FROM "LedgerJournal" j WHERE EXISTS (SELECT 1 FROM "Payment" p LEFT JOIN "PaymentAttempt" a ON a."paymentId" = p."id" WHERE p."provider"::text = 'PAYFAST' AND (j."sourceReference" IN (p."paymentNumber", p."id", a."publicReference", a."merchantReference", a."id") OR j."correlationId" IN (p."paymentNumber", p."id", a."publicReference", a."merchantReference", a."id") OR COALESCE(j."metadata"::text, '') LIKE '%' || p."paymentNumber" || '%' OR COALESCE(j."metadata"::text, '') LIKE '%' || a."merchantReference" || '%'))`],
  ["no order status history was created after Payfast preparation", `SELECT COUNT(*)::int AS count FROM "OrderStatusHistory" h JOIN "Payment" p ON p."orderId" = h."orderId" WHERE p."provider"::text = 'PAYFAST' AND h."createdAt" >= p."createdAt"`],
  ["production checkout remains inactive", `SELECT COUNT(*)::int AS count FROM "PaymentAttempt" WHERE "provider"::text = 'PAYFAST' AND "providerEnvironment"::text = 'PRODUCTION'`],
];

async function main() {
  const failures = [];
  for (const [name, sql] of checks) {
    const rows = await prisma.$queryRawUnsafe(sql);
    const count = Number(rows[0]?.count ?? 0);
    console.log(`${count ? "FAIL" : "PASS"}: ${name}${count ? ` (${count})` : ""}`);
    if (count) failures.push(name);
  }
  const files = await Promise.all([
    "../lib/services/payment-preparation.service.ts", "../lib/services/payment-provider-session.service.ts", "../lib/services/payfast-checkout.service.ts",
    "../app/(payments)/payments/payfast/return/page.tsx", "../app/(payments)/payments/payfast/cancel/page.tsx", "../app/api/payments/payfast/itn/route.ts",
  ].map((file) => readFile(new URL(file, import.meta.url), "utf8")));
  const source = files.join("\n");
  const sourceChecks = [
    ["no ledger or wallet mutation", /(?:ledgerJournal|ledgerEntry|walletTransaction)\.(?:create|update|upsert)/],
    ["no order, pricing, dispatch, or driver mutation", /(?:order|pricingQuote|orderAssignment|driverProfile)\.(?:create|update|updateMany|delete|upsert)/],
    ["no ITN or refund processing", /paymentWebhookEvent\.(?:create|update)|paymentRefund\.(?:create|update)/],
    ["no public Payfast security configuration", /NEXT_PUBLIC_(?:PAYFAST|PAYMENT)/],
  ];
  for (const [name, pattern] of sourceChecks) {
    const failed = pattern.test(source);
    console.log(`${failed ? "FAIL" : "PASS"}: ${name}`);
    if (failed) failures.push(name);
  }
  if (failures.length) throw new Error(`Payfast invariant verification failed: ${failures.join("; ")}.`);
  console.log("Payfast invariant verification passed.");
}

try { await main(); } catch (error) {
  console.error(error instanceof Error ? error.message : "Payfast invariant verification failed.");
  process.exitCode = 1;
} finally { await prisma.$disconnect(); }
