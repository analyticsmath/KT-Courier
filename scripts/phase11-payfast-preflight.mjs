import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const checks = [
  ["non-ZAR or non-positive payments", `SELECT COUNT(*)::int AS count FROM "Payment" WHERE "amount" <= 0 OR "currency"::text <> 'ZAR'`],
  ["unsupported runtime attempt providers", `SELECT COUNT(*)::int AS count FROM "PaymentAttempt" WHERE "provider"::text <> 'PAYFAST'`],
  ["malformed Payfast merchant references", `SELECT COUNT(*)::int AS count FROM "PaymentAttempt" WHERE "provider"::text = 'PAYFAST' AND (length("merchantReference") > 100 OR "merchantReference" !~ '^kt:payment:pay_[A-Za-z0-9_-]+:attempt:[1-9][0-9]*$')`],
  ["missing Payfast attempt public references", `SELECT COUNT(*)::int AS count FROM "PaymentAttempt" WHERE "provider"::text = 'PAYFAST' AND "publicReference" IS NULL`],
  ["incompatible form-action audit", `SELECT COUNT(*)::int AS count FROM "PaymentAttempt" WHERE "checkoutActionType"::text = 'FORM_POST' AND ("redirectUrl" IS NOT NULL OR "providerEnvironment" IS NULL OR "checkoutPreparedAt" IS NULL OR "providerProtocolVersion" IS NULL OR "configurationFingerprint" IS NULL)`],
  ["impossible payment/attempt state pairs", `SELECT COUNT(*)::int AS count FROM "PaymentAttempt" a JOIN "Payment" p ON p."id" = a."paymentId" WHERE (a."status"::text = 'REQUIRES_ACTION' AND p."status"::text <> 'REQUIRES_ACTION') OR (a."status"::text = 'UNKNOWN' AND p."status"::text <> 'PROCESSING')`],
  ["unsafe provider snapshots", `SELECT COUNT(*)::int AS count FROM "PaymentAttempt" WHERE COALESCE("requestSnapshot"::text, '') ~* '(merchant[_-]?key|passphrase|signature|email_address)' OR COALESCE("resultSnapshot"::text, '') ~* '(merchant[_-]?key|passphrase|signature|email_address)' OR COALESCE("providerPayload"::text, '') ~* '(merchant[_-]?key|passphrase|signature|email_address)'`],
  ["Payfast provider references without authoritative evidence", `SELECT COUNT(*)::int AS count FROM "PaymentAttempt" WHERE "provider"::text = 'PAYFAST' AND "providerReference" IS NOT NULL`],
  ["unsupported production checkout attempts", `SELECT COUNT(*)::int AS count FROM "PaymentAttempt" WHERE "provider"::text = 'PAYFAST' AND "providerEnvironment"::text = 'PRODUCTION'`],
];

async function main() {
  const blockers = [];
  for (const [name, sql] of checks) {
    const rows = await prisma.$queryRawUnsafe(sql);
    const count = Number(rows[0]?.count ?? 0);
    console.log(`${count ? "BLOCK" : "CLEAR"}: ${name}${count ? ` (${count})` : ""}`);
    if (count) blockers.push(name);
  }
  if (blockers.length) throw new Error(`Phase 11 Payfast preflight blocked: ${blockers.join("; ")}.`);
  console.log("Phase 11 Payfast preflight passed.");
}

try { await main(); } catch (error) {
  console.error(error instanceof Error ? error.message : "Phase 11 Payfast preflight failed.");
  process.exitCode = 1;
} finally { await prisma.$disconnect(); }
