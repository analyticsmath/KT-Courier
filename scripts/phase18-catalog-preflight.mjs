import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const blockers = [];
async function scalar(sql) { const rows = await prisma.$queryRawUnsafe(sql); return Number(rows[0]?.count ?? 0); }
async function table(name) { return Boolean(await scalar(`SELECT COUNT(*)::int count FROM information_schema.tables WHERE table_schema=current_schema() AND table_name='${name.replaceAll("'", "''")}'`)); }
async function check(label, sql) { const count = await scalar(sql); console.log(`${count ? "BLOCK" : "CLEAR"}: ${label}${count ? ` (${count})` : ""}`); if (count) blockers.push(label); }

async function main() {
  await check("active legacy products", `SELECT COUNT(*)::int count FROM "Product" WHERE "status"::text IN ('ACTIVE','OUT_OF_STOCK')`);
  await check("legacy inventory reservations", `SELECT COUNT(*)::int count FROM "InventoryItem" WHERE "quantityReserved"<>0`);
  await check("legacy arbitrary product image URLs", `SELECT COUNT(*)::int count FROM "ProductImage" WHERE "url" ~* '^https?://'`);
  await check("legacy products with invalid store ownership", `SELECT COUNT(*)::int count FROM "Product" p LEFT JOIN "Store" s ON s."id"=p."storeId" WHERE s."id" IS NULL OR s."ownerUserId" IS NULL`);
  if (await table("CatalogProduct")) {
    await check("products missing exact product-type version", `SELECT COUNT(*)::int count FROM "CatalogProduct" p LEFT JOIN "ProductTypeDefinition" t ON t."id"=p."productTypeDefinitionId" WHERE t."id" IS NULL OR t."versionNumber"<>p."productTypeVersionNumber"`);
    await check("products without variants", `SELECT COUNT(*)::int count FROM "CatalogProduct" p WHERE NOT EXISTS (SELECT 1 FROM "CatalogProductVariant" v WHERE v."productId"=p."id")`);
    await check("duplicate normalized GTIN", `SELECT COUNT(*)::int count FROM (SELECT "gtin" FROM "CatalogProductVariant" WHERE "gtin" IS NOT NULL GROUP BY "gtin" HAVING COUNT(*)>1) x`);
    await check("duplicate store SKU", `SELECT COUNT(*)::int count FROM (SELECT "storeId", upper(btrim("storeSku")) sku FROM "StoreCatalogOffer" GROUP BY 1,2 HAVING COUNT(*)>1) x`);
    await check("duplicate variant fingerprints", `SELECT COUNT(*)::int count FROM (SELECT "productId","optionFingerprint" FROM "CatalogProductVariant" GROUP BY 1,2 HAVING COUNT(*)>1) x`);
    await check("category cycles", `WITH RECURSIVE walk AS (SELECT "id","parentId",ARRAY["id"] seen,false cycle FROM "CatalogCategory" UNION ALL SELECT c."id",c."parentId",w.seen||c."id",c."id"=ANY(w.seen) FROM "CatalogCategory" c JOIN walk w ON c."id"=w."parentId" WHERE NOT w.cycle) SELECT COUNT(*)::int count FROM walk WHERE cycle`);
    await check("invalid product-type JSON shape", `SELECT COUNT(*)::int count FROM "ProductTypeDefinition" WHERE jsonb_typeof("attributeSchema")<>'object' OR jsonb_typeof("variantSchema")<>'object' OR jsonb_typeof("complianceSchema")<>'object' OR jsonb_typeof("searchFacetSchema")<>'object'`);
    await check("overlapping scheduled or active prices", `SELECT COUNT(*)::int count FROM "StoreOfferPriceVersion" a JOIN "StoreOfferPriceVersion" b ON a."offerId"=b."offerId" AND a."id"<b."id" AND a."status"::text IN ('SCHEDULED','ACTIVE') AND b."status"::text IN ('SCHEDULED','ACTIVE') AND tsrange(a."effectiveFrom",COALESCE(a."effectiveUntil",'infinity'),'[)') && tsrange(b."effectiveFrom",COALESCE(b."effectiveUntil",'infinity'),'[)')`);
    await check("invalid inventory projections", `SELECT COUNT(*)::int count FROM "CatalogInventoryLevel" WHERE "onHand"<0 OR "reserved"<0 OR "reserved">"onHand" OR "available"<>"onHand"-"reserved"`);
    await check("fabricated Phase 18 reservations", `SELECT COUNT(*)::int count FROM "CatalogInventoryLevel" WHERE "reserved"<>0`);
    await check("tracked stock without movement evidence", `SELECT COUNT(*)::int count FROM "CatalogInventoryLevel" l JOIN "CatalogInventoryItem" i ON i."id"=l."inventoryItemId" WHERE i."trackingMode"::text='TRACKED' AND l."onHand"<>0 AND NOT EXISTS (SELECT 1 FROM "CatalogInventoryMovement" m WHERE m."inventoryItemId"=l."inventoryItemId" AND m."locationId"=l."locationId")`);
    await check("active products missing moderation", `SELECT COUNT(*)::int count FROM "CatalogProduct" WHERE "status"::text='ACTIVE' AND "moderationStatus"::text<>'APPROVED'`);
    await check("active offers missing current prices", `SELECT COUNT(*)::int count FROM "StoreCatalogOffer" WHERE "status"::text='ACTIVE' AND "currentPriceVersionId" IS NULL`);
    const published = await scalar(`SELECT ((SELECT COUNT(*) FROM "CatalogProduct" WHERE "publicationStatus"::text='PUBLISHED') + (SELECT COUNT(*) FROM "StoreCatalogOffer" WHERE "publicationStatus"::text='PUBLISHED') + (SELECT COUNT(*) FROM "CatalogPublicationSnapshot" WHERE "status"::text='PUBLISHED'))::int count`);
    if (published && process.env.NODE_ENV === "production") {
      console.log(`BLOCK: publication before consolidated validation (${published})`);
      blockers.push("publication before consolidated validation");
    } else if (published) {
      console.log(`CLASSIFIED: existing local-demo publication projections (${published}); production publication remains source-locked.`);
    } else {
      console.log("CLEAR: publication before consolidated validation");
    }
  }
  if (blockers.length) throw new Error(`Phase 18 catalog preflight blocked: ${blockers.join("; ")}.`);
  console.log("Phase 18 catalog preflight passed. This is not production validation.");
}

try { await main(); } catch (error) { console.error(error instanceof Error ? error.message : "Catalog preflight failed."); process.exitCode = 1; } finally { await prisma.$disconnect(); }
