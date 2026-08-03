import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient(); const blockers = [];
async function scalar(sql) { const rows = await prisma.$queryRawUnsafe(sql); return Number(rows[0]?.count ?? 0); }
async function check(label, sql) { const count = await scalar(sql); console.log(`${count ? "BLOCK" : "CLEAR"}: ${label}${count ? ` (${count})` : ""}`); if (count) blockers.push(label); }
async function main() {
  await check("projection without published snapshot", `SELECT COUNT(*)::int count FROM "StorefrontProductDocument" d LEFT JOIN "CatalogPublicationSnapshot" s ON s."id"=d."publicationSnapshotId" WHERE s."id" IS NULL OR s."status"::text<>'PUBLISHED' OR s."publicationVersion"<>d."publicationVersion"`);
  await check("duplicate storefront identity", `SELECT COUNT(*)::int count FROM (SELECT "publicationSnapshotId","variantId","offerId" FROM "StorefrontProductDocument" GROUP BY 1,2,3 HAVING COUNT(*)>1)x`);
  await check("private media/storage reference", `SELECT COUNT(*)::int count FROM "StorefrontProductDocument" WHERE "primaryMediaPublicReference" ~ '/' OR "searchText" ~* '(storagekey|operationid|requesthash|email|phone)'`);
  await check("exact stock leakage", `SELECT COUNT(*)::int count FROM "StorefrontProductDocument" WHERE "searchText" ~* '(onhand|reserved|available[[:space:]]*:[[:space:]]*[0-9]+)'`);
  await check("suspended source exposure", `SELECT COUNT(*)::int count FROM "StorefrontProductDocument" d JOIN "Store" s ON s."id"=d."storeId" WHERE d."status"::text='ACTIVE' AND s."status"::text<>'ACTIVE'`);
  await check("invalid exact price", `SELECT COUNT(*)::int count FROM "StorefrontProductDocument" WHERE "priceAmount"<=0 OR "currency"<>'ZAR' OR NOT "priceIncludesTax"`);
  await check("public indexing before Phase 26.5", `SELECT COUNT(*)::int count FROM "StorefrontProductDocument" WHERE "indexable"`);
  if (blockers.length) throw new Error(`Storefront preflight blocked: ${blockers.join("; ")}.`);
  console.log("Storefront preflight passed. This is not production validation.");
}
try { await main(); } catch (error) { console.error(error instanceof Error ? error.message : "Storefront preflight failed."); process.exitCode = 1; } finally { await prisma.$disconnect(); }

