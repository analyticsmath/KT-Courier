import { readFile } from "node:fs/promises";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const checks = [
  ["event fingerprints are unique", `SELECT COUNT(*)::int AS count FROM (SELECT "eventFingerprint" FROM "PaymentWebhookEvent" GROUP BY "eventFingerprint" HAVING COUNT(*) > 1) d`],
  ["APPLIED events have payment and attempt", `SELECT COUNT(*)::int AS count FROM "PaymentWebhookEvent" WHERE "itnProcessingStatus"::text = 'APPLIED' AND ("paymentId" IS NULL OR "attemptId" IS NULL)`],
  ["legacy compatibility fields remain null", `SELECT COUNT(*)::int AS count FROM "PaymentWebhookEvent" WHERE "providerEventId" IS NOT NULL OR "eventType" IS NOT NULL OR "processingStatus" IS NOT NULL OR "signatureValid" IS NOT NULL OR "payload" IS NOT NULL OR "errorMessage" IS NOT NULL OR "processedAt" IS NOT NULL`],
  ["successful payments have a verified COMPLETE event", `SELECT COUNT(*)::int AS count FROM "Payment" p LEFT JOIN "PaymentWebhookEvent" e ON e."id" = p."successWebhookEventId" WHERE p."status"::text = 'SUCCEEDED' AND (e."id" IS NULL OR e."normalizedStatus"::text <> 'COMPLETE' OR NOT e."providerDataVerified")`],
  ["successful payments have one receipt journal", `SELECT COUNT(*)::int AS count FROM "Payment" p LEFT JOIN "LedgerJournal" j ON j."id" = p."successLedgerJournalId" WHERE p."status"::text = 'SUCCEEDED' AND (j."id" IS NULL OR j."type"::text <> 'EXTERNAL_PAYMENT_RECEIPT')`],
  ["journal amount equals payment amount", `SELECT COUNT(*)::int AS count FROM "Payment" p JOIN "LedgerJournal" j ON j."id" = p."successLedgerJournalId" WHERE j."totalDebits" <> p."amount" OR j."totalCredits" <> p."amount"`],
  ["receipt journals are ZAR", `SELECT COUNT(*)::int AS count FROM "LedgerJournal" WHERE "type"::text = 'EXTERNAL_PAYMENT_RECEIPT' AND "currency"::text <> 'ZAR'`],
  ["receipt journals debit cash clearing", `SELECT COUNT(*)::int AS count FROM "LedgerJournal" j WHERE j."type"::text = 'EXTERNAL_PAYMENT_RECEIPT' AND NOT EXISTS (SELECT 1 FROM "LedgerEntry" e JOIN "LedgerAccount" a ON a."id" = e."accountId" WHERE e."journalId" = j."id" AND e."direction"::text = 'DEBIT' AND a."purpose"::text = 'CASH_CLEARING' AND a."category"::text = 'ASSET')`],
  ["receipt journals credit held liability", `SELECT COUNT(*)::int AS count FROM "LedgerJournal" j WHERE j."type"::text = 'EXTERNAL_PAYMENT_RECEIPT' AND NOT EXISTS (SELECT 1 FROM "LedgerEntry" e JOIN "LedgerAccount" a ON a."id" = e."accountId" WHERE e."journalId" = j."id" AND e."direction"::text = 'CREDIT' AND a."purpose"::text = 'HELD' AND a."category"::text = 'LIABILITY')`],
  ["receipt journals balance", `SELECT COUNT(*)::int AS count FROM "LedgerJournal" WHERE "type"::text = 'EXTERNAL_PAYMENT_RECEIPT' AND "totalDebits" <> "totalCredits"`],
  ["same payment has no second receipt journal", `SELECT COUNT(*)::int AS count FROM (SELECT p."id" FROM "Payment" p JOIN "LedgerJournal" j ON j."correlationId" = p."publicReference" WHERE j."type"::text = 'EXTERNAL_PAYMENT_RECEIPT' GROUP BY p."id" HAVING COUNT(*) > 1) d`],
  ["provider payment IDs are coherent", `SELECT COUNT(*)::int AS count FROM "PaymentWebhookEvent" e JOIN "PaymentAttempt" a ON a."id" = e."attemptId" WHERE e."providerDataVerified" AND a."providerReference" IS NOT NULL AND e."providerPaymentId" <> a."providerReference" AND e."itnProcessingStatus"::text NOT IN ('RECONCILIATION_REQUIRED','REJECTED')`],
  ["event payment/attempt relations are coherent", `SELECT COUNT(*)::int AS count FROM "PaymentWebhookEvent" e JOIN "PaymentAttempt" a ON a."id" = e."attemptId" WHERE e."paymentId" IS DISTINCT FROM a."paymentId" OR e."merchantReference" IS DISTINCT FROM a."merchantReference" OR e."provider" IS DISTINCT FROM a."provider"`],
  ["FAILED or PENDING events post no journals", `SELECT COUNT(*)::int AS count FROM "PaymentWebhookEvent" WHERE "normalizedStatus"::text IN ('FAILED','PENDING') AND "ledgerJournalId" IS NOT NULL`],
  ["stale ignored events preserve success", `SELECT COUNT(*)::int AS count FROM "PaymentWebhookEvent" e LEFT JOIN "Payment" p ON p."id" = e."paymentId" WHERE e."itnProcessingStatus"::text = 'IGNORED_STALE' AND (e."normalizedStatus"::text <> 'PENDING' OR p."status"::text <> 'SUCCEEDED' OR e."ledgerJournalId" IS NOT NULL)`],
  ["successful event/journal links are canonical", `SELECT COUNT(*)::int AS count FROM "Payment" p JOIN "PaymentWebhookEvent" e ON e."id" = p."successWebhookEventId" WHERE e."ledgerJournalId" IS DISTINCT FROM p."successLedgerJournalId" OR e."attemptId" IS DISTINCT FROM p."successfulAttemptId"`],
  ["reconciliation case keys are unique", `SELECT COUNT(*)::int AS count FROM (SELECT "caseKey" FROM "PaymentReconciliationCase" GROUP BY "caseKey" HAVING COUNT(*) > 1) d`],
  ["reconciliation status/timestamps are coherent", `SELECT COUNT(*)::int AS count FROM "PaymentReconciliationCase" WHERE ("status"::text IN ('RESOLVED','CLOSED') AND ("resolvedAt" IS NULL OR "resolutionCode" IS NULL)) OR ("status"::text IN ('OPEN','MONITORING') AND ("resolvedAt" IS NOT NULL OR "resolutionCode" IS NOT NULL)) OR "observationCount" < 1`],
  ["Payfast fees are not posted", `SELECT COUNT(*)::int AS count FROM "LedgerJournal" WHERE "type"::text = 'EXTERNAL_PAYMENT_RECEIPT' AND (COALESCE("memo", '') ~* 'fee expense' OR COALESCE("metadata"::text, '') ~* 'amount_fee|amount_net')`],
  ["production attempts remain absent before approval", `SELECT COUNT(*)::int AS count FROM "PaymentAttempt" WHERE "provider"::text = 'PAYFAST' AND "providerEnvironment"::text = 'PRODUCTION'`],
];

async function main() {
  const failures = [];
  for (const [name, sql] of checks) {
    const rows = await prisma.$queryRawUnsafe(sql);
    const count = Number(rows[0]?.count ?? 0);
    console.log(`${count ? "FAIL" : "PASS"}: ${name}${count ? ` (${count})` : ""}`);
    if (count) failures.push(name);
  }
  const eventRows = await prisma.$queryRawUnsafe(`SELECT CONCAT_WS(' ', COALESCE("safePayloadSnapshot"::text, ''), COALESCE("rejectionCode", ''), COALESCE("reconciliationReason"::text, '')) AS data FROM "PaymentWebhookEvent"`);
  const forbidden = /(passphrase|merchant[_-]?key|signature(base)?|raw(body|payload)|authorization|cookie|email_address|name_first|name_last)/i;
  if (eventRows.some((row) => forbidden.test(row.data))) failures.push("webhook persistence contains prohibited material");

  const routeSource = await readFile(new URL("../app/api/payments/payfast/itn/route.ts", import.meta.url), "utf8");
  const applicationSource = await readFile(new URL("../lib/services/payfast-itn-application.service.ts", import.meta.url), "utf8");
  const verificationSource = await readFile(new URL("../lib/services/payfast-itn-verification.service.ts", import.meta.url), "utf8");
  const confirmationQuerySource = await readFile(new URL("../lib/services/payment-confirmation-query.service.ts", import.meta.url), "utf8");
  const confirmationDtoSource = await readFile(new URL("../lib/dto/payment-confirmation.dto.ts", import.meta.url), "utf8");
  const compatibilityField = /legacy(?:ProviderEventId|EventType|ProcessingStatus|SignatureValid|Payload|ErrorMessage|ProcessedAt)/;
  const sourceChecks = [
    ["ITN route has no redirect", /redirect\s*\(/.test(routeSource)],
    ["ITN route has no browser-session authority", /getCurrentUser|requireAuth|requireOrigin/.test(routeSource)],
    ["payment confirmation mutates no Order", /\b(?:tx\.)?order\.(?:create|update|updateMany|delete|upsert)\b/.test(applicationSource)],
    ["payment confirmation creates no refund", /paymentRefund\.(?:create|update|upsert)/.test(applicationSource)],
    ["runtime writes no legacy compatibility fields", compatibilityField.test(applicationSource) || compatibilityField.test(verificationSource)],
    ["verification reads no legacy compatibility fields", compatibilityField.test(verificationSource)],
    ["payment confirmation DTO exposes no legacy compatibility fields", compatibilityField.test(confirmationDtoSource) || compatibilityField.test(confirmationQuerySource)],
    ["raw ITN body is persisted", /(?:bodyBytes|bodyText|exactFormBody|rawBody|rawPayload)\s*:/.test(applicationSource)],
  ];
  for (const [name, failed] of sourceChecks) { console.log(`${failed ? "FAIL" : "PASS"}: ${name}`); if (failed) failures.push(name); }
  if (failures.length) throw new Error(`Payment confirmation invariant verification failed: ${failures.join("; ")}.`);
  console.log("Payment confirmation invariant verification passed.");
}

try { await main(); } catch (error) { console.error(error instanceof Error ? error.message : "Payment confirmation invariant verification failed."); process.exitCode = 1; }
finally { await prisma.$disconnect(); }
