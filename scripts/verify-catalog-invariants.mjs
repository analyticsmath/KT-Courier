import { readFile } from "node:fs/promises";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const checks = [
  ["1 product type version", `SELECT COUNT(*)::int count FROM "CatalogProduct" p LEFT JOIN "ProductTypeDefinition" t ON t."id"=p."productTypeDefinitionId" WHERE t."versionNumber" IS DISTINCT FROM p."productTypeVersionNumber"`],
  ["2 product variant", `SELECT COUNT(*)::int count FROM "CatalogProduct" p WHERE NOT EXISTS(SELECT 1 FROM "CatalogProductVariant" v WHERE v."productId"=p."id")`],
  ["3 variant combination", `SELECT COUNT(*)::int count FROM (SELECT "productId","optionFingerprint" FROM "CatalogProductVariant" GROUP BY 1,2 HAVING COUNT(*)>1)x`],
  ["4 GTIN normalized unique", `SELECT COUNT(*)::int count FROM "CatalogProductVariant" WHERE "gtin" IS NOT NULL AND ("gtin"!~'^[0-9]{8}$|^[0-9]{12}$|^[0-9]{13}$|^[0-9]{14}$' OR "gtin"~'^0+$')`],
  ["5 store SKU unique", `SELECT COUNT(*)::int count FROM (SELECT "storeId",upper(btrim("storeSku")) FROM "StoreCatalogOffer" GROUP BY 1,2 HAVING COUNT(*)>1)x`],
  ["6 canonical content separation", `SELECT COUNT(*)::int count FROM "StoreCatalogOffer" o JOIN "CatalogProduct" p ON p."id"=o."productId" WHERE o."merchantTitle" IS NOT NULL AND lower(btrim(o."merchantTitle"))=lower(btrim(p."title")) AND o."merchantDescription" IS NOT NULL AND o."merchantDescription"<>p."description"`],
  ["7 attribute JSON shape", `SELECT COUNT(*)::int count FROM "CatalogProduct" WHERE jsonb_typeof("attributeValues")<>'object'`],
  ["8 category path depth", `SELECT COUNT(*)::int count FROM "CatalogCategory" WHERE "depth"<>array_length(regexp_split_to_array(trim(both '/' from "path"),'/'),1)-1`],
  ["9 price overlap", `SELECT COUNT(*)::int count FROM "StoreOfferPriceVersion" a JOIN "StoreOfferPriceVersion" b ON a."offerId"=b."offerId" AND a."id"<b."id" AND a."status"::text IN ('SCHEDULED','ACTIVE') AND b."status"::text IN ('SCHEDULED','ACTIVE') AND tsrange(a."effectiveFrom",COALESCE(a."effectiveUntil",'infinity'),'[)') && tsrange(b."effectiveFrom",COALESCE(b."effectiveUntil",'infinity'),'[)')`],
  ["10 positive ZAR", `SELECT COUNT(*)::int count FROM "StoreOfferPriceVersion" WHERE "amount"<=0 OR "currency"<>'ZAR'`],
  ["11 VAT display", `SELECT COUNT(*)::int count FROM "StoreOfferPriceVersion" WHERE NOT "priceIncludesTax"`],
  ["12-13 inventory projection", `SELECT COUNT(*)::int count FROM "CatalogInventoryLevel" WHERE "reserved"<>0 OR "available"<>"onHand"-"reserved" OR "onHand"<0`],
  ["14 movement resulting stock", `SELECT COUNT(*)::int count FROM "CatalogInventoryMovement" m WHERE m."resultingOnHand"<0`],
  ["15 active moderation", `SELECT COUNT(*)::int count FROM "CatalogProduct" WHERE "status"::text='ACTIVE' AND "moderationStatus"::text<>'APPROVED'`],
  ["16 active offer readiness", `SELECT COUNT(*)::int count FROM "StoreCatalogOffer" o LEFT JOIN "CatalogProduct" p ON p."id"=o."productId" WHERE o."status"::text='ACTIVE' AND (p."status"::text<>'ACTIVE' OR o."currentPriceVersionId" IS NULL)`],
  ["17 suspended product offer", `SELECT COUNT(*)::int count FROM "StoreCatalogOffer" o JOIN "CatalogProduct" p ON p."id"=o."productId" WHERE p."status"::text='SUSPENDED' AND o."publicationStatus"::text='PUBLISHED'`],
  ["18 restricted publication", `SELECT COUNT(*)::int count FROM "CatalogProduct" WHERE "publicationStatus"::text='PUBLISHED' AND lower("title")~'(weapon|ammunition|tobacco|nicotine|alcohol|prescription)'`],
  ["19 snapshot state", `SELECT COUNT(*)::int count FROM "CatalogPublicationSnapshot" s JOIN "StoreCatalogOffer" o ON o."id"=s."offerId" WHERE s."status"::text='PUBLISHED' AND o."publicationStatus"::text<>'PUBLISHED'`],
  ["20 event versions", `SELECT COUNT(*)::int count FROM (SELECT "aggregateType","aggregateReference","aggregateVersion","eventType" FROM "CatalogChangeEvent" GROUP BY 1,2,3,4 HAVING COUNT(*)>1)x`],
  ["24 production publication lock", `SELECT COUNT(*)::int count FROM "CatalogPublicationSnapshot" WHERE "status"::text='PUBLISHED'`],
];
async function main() {
  const failures=[]; for(const [name,sql] of checks){const rows=await prisma.$queryRawUnsafe(sql);const count=Number(rows[0]?.count??0);console.log(`${count?"FAIL":"PASS"}: ${name}${count?` (${count})`:""}`);if(count)failures.push(name)}
  const routeFiles = await Promise.all(["app/api/store/catalog/products/route.ts","app/api/store/catalog/offers/route.ts","app/api/store/catalog/inventory/[publicReference]/movements/route.ts"].map((file)=>readFile(new URL(`../${file}`,import.meta.url),"utf8")));
  const source=routeFiles.join("\n"); if(/\b(cart|checkout|order|payment|ledger|earning)\.(?:create|update|upsert|delete)/.test(source)) failures.push("21-23 prohibited commerce or finance writer");
  const lock=await readFile(new URL("../lib/catalog/catalog-production-lock.ts",import.meta.url),"utf8"); if(!/CATALOG_PRODUCTION_VALIDATION_APPROVED\s*=\s*false/.test(lock)||/process\.env/.test(lock)) failures.push("24 source production lock");
  if(failures.length)throw new Error(`Catalog invariant verification failed: ${failures.join("; ")}.`); console.log("Catalog invariant verification passed. Deep validation remains deferred.");
}
try{await main()}catch(error){console.error(error instanceof Error?error.message:"Catalog invariant verification failed.");process.exitCode=1}finally{await prisma.$disconnect()}

