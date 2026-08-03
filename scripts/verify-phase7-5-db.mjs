import process from "node:process";
import { PrismaClient } from "@prisma/client";
import { loadLocalEnv, safeError, safeLog } from "./docker-common.mjs";

const env = loadLocalEnv();
if (!env.DATABASE_URL) {
  safeError("DATABASE_URL is required for Phase 7.5 invariant verification.");
  process.exit(1);
}

const prisma = new PrismaClient({
  datasources: { db: { url: env.DATABASE_URL } },
});

const invariants = [
  [
    "quote totals reconcile",
    `SELECT count(*)::int AS violations
     FROM "PricingQuote"
     WHERE "currency" <> 'ZAR'
        OR "subtotal" < 0 OR "taxAmount" < 0 OR "total" < 0
        OR "total" <> "subtotal" + "taxAmount"`,
  ],
  [
    "quote line items reconcile",
    `SELECT count(*)::int AS violations
     FROM "PricingQuote" q
     LEFT JOIN LATERAL (
       SELECT COALESCE(sum("amount") FILTER (WHERE "code" <> 'VAT'), 0) AS subtotal,
              COALESCE(sum("amount") FILTER (WHERE "code" = 'VAT'), 0) AS tax
       FROM "PricingQuoteLineItem" li WHERE li."quoteId" = q."id"
     ) li ON true
     WHERE li.subtotal <> q."subtotal" OR li.tax <> q."taxAmount"`,
  ],
  [
    "used quote has exactly one order",
    `SELECT count(*)::int AS violations FROM (
       SELECT q."id"
       FROM "PricingQuote" q
       LEFT JOIN "Order" o ON o."pricingQuoteId" = q."id"
       GROUP BY q."id", q."status"
       HAVING (q."status" = 'USED' AND count(o."id") <> 1)
           OR (q."status" <> 'USED' AND count(o."id") <> 0)
     ) invalid_quote_links`,
  ],
  [
    "one current assignment per order",
    `SELECT count(*)::int AS violations FROM (
       SELECT "orderId" FROM "OrderAssignment"
       WHERE "status" IN ('ASSIGNED', 'ACCEPTED')
       GROUP BY "orderId" HAVING count(*) <> 1
     ) current_assignments`,
  ],
  [
    "driver capacity",
    `SELECT count(*)::int AS violations FROM (
       SELECT a."driverProfileId" FROM "OrderAssignment" a
       JOIN "DriverProfile" d ON d."id" = a."driverProfileId"
       WHERE a."status" IN ('ASSIGNED', 'ACCEPTED')
       GROUP BY a."driverProfileId", d."maxConcurrentAssignments"
       HAVING count(*) > d."maxConcurrentAssignments"
     ) overloaded_drivers`,
  ],
  [
    "current-driver pointer",
    `SELECT count(*)::int AS violations FROM "Order" o
     FULL OUTER JOIN "OrderAssignment" a
       ON a."orderId" = o."id" AND a."status" = 'ACCEPTED'
     WHERE o."id" IS NOT NULL
       AND o."currentDriverProfileId" IS DISTINCT FROM a."driverProfileId"`,
  ],
  [
    "assignment/order compatibility",
    `SELECT count(*)::int AS violations FROM "OrderAssignment" a
     JOIN "Order" o ON o."id" = a."orderId"
     WHERE (a."status" = 'ASSIGNED'
            AND o."status" NOT IN ('CONFIRMED', 'PICKUP_SCHEDULED'))
        OR (a."status" = 'ACCEPTED'
            AND o."status" IN ('DELIVERED', 'COMPLETED', 'CANCELLED', 'FAILED'))`,
  ],
  [
    "order pricing immutability",
    `SELECT count(*)::int AS violations FROM "Order" o
     JOIN "PricingQuote" q ON q."id" = o."pricingQuoteId"
     WHERE o."priceEstimate" IS DISTINCT FROM q."total"
        OR o."pricingSubtotal" IS DISTINCT FROM q."subtotal"
        OR o."pricingTaxAmount" IS DISTINCT FROM q."taxAmount"
        OR o."pricingTaxRate" IS DISTINCT FROM q."taxRate"`,
  ],
];

let failed = false;
try {
  for (const [name, query] of invariants) {
    const [row] = await prisma.$queryRawUnsafe(query);
    const violations = Number(row.violations ?? 0);
    if (violations !== 0) {
      failed = true;
      safeError(`Invariant failed: ${name} (${violations} violation${violations === 1 ? "" : "s"}).`);
    } else {
      safeLog(`Invariant passed: ${name}.`);
    }
  }
} catch (error) {
  failed = true;
  safeError(error instanceof Error ? error.message : String(error));
} finally {
  await prisma.$disconnect();
}

process.exit(failed ? 1 : 0);
