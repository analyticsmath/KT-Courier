import { readFile } from "node:fs/promises";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const checks = [
  ["published snapshot source", `SELECT COUNT(*)::int count FROM "StorefrontProductDocument" d LEFT JOIN "CatalogPublicationSnapshot" s ON s."id"=d."publicationSnapshotId" WHERE s."status"::text<>'PUBLISHED' OR s."publicationVersion"<>d."publicationVersion"`],
  ["exact ZAR price", `SELECT COUNT(*)::int count FROM "StorefrontProductDocument" WHERE "priceAmount"<=0 OR "currency"<>'ZAR' OR NOT "priceIncludesTax"`],
  ["private media and exact stock", `SELECT COUNT(*)::int count FROM "StorefrontProductDocument" WHERE "primaryMediaPublicReference" ~ '/' OR "searchText" ~* '(storagekey|operationid|requesthash|onhand|reserved)'`],
  ["active source eligibility", `SELECT COUNT(*)::int count FROM "StorefrontProductDocument" d JOIN "StoreCatalogOffer" o ON o."id"=d."offerId" JOIN "Store" s ON s."id"=d."storeId" WHERE d."status"::text='ACTIVE' AND (o."status"::text<>'ACTIVE' OR o."publicationStatus"::text<>'PUBLISHED' OR s."status"::text<>'ACTIVE')`],
  ["production exposure lock", `SELECT COUNT(*)::int count FROM "StorefrontProductDocument" WHERE "indexable"`],
];
async function main() { const failures=[]; for (const [name, sql] of checks) { const rows=await prisma.$queryRawUnsafe(sql); const count=Number(rows[0]?.count??0); console.log(`${count?"FAIL":"PASS"}: ${name}${count?` (${count})`:""}`); if(count) failures.push(name); } const lock=await readFile(new URL("../lib/storefront/storefront-production-lock.ts",import.meta.url),"utf8"); if(!/STOREFRONT_PRODUCTION_VALIDATION_APPROVED\s*=\s*false/.test(lock)||/process\.env/.test(lock)) failures.push("source production lock"); if(failures.length) throw new Error(`Storefront invariant verification failed: ${failures.join("; ")}.`); console.log("Storefront invariant verification passed. Deep validation remains deferred."); }
try { await main(); } catch (error) { console.error(error instanceof Error ? error.message : "Storefront invariant verification failed."); process.exitCode = 1; } finally { await prisma.$disconnect(); }

