import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const checks = [
  ["invalid owner scope", `SELECT COUNT(*)::int count FROM "CatalogMediaAsset" WHERE ("ownerType"='PLATFORM' AND "ownerStoreId" IS NOT NULL) OR ("ownerType"='STORE' AND "ownerStoreId" IS NULL)`],
  ["READY asset missing validation evidence", `SELECT COUNT(*)::int count FROM "CatalogMediaAsset" WHERE "status"='READY' AND ("checksum" IS NULL OR "mimeType" IS NULL OR "byteSize" IS NULL OR "width" IS NULL OR "height" IS NULL OR "storageConfirmedAt" IS NULL OR "validatedAt" IS NULL OR NOT "privacyInspectionPassed")`],
  ["invalid checksum evidence", `SELECT COUNT(*)::int count FROM "CatalogMediaAsset" WHERE "checksum" IS NOT NULL AND "checksum" !~ '^[0-9a-f]{64}$'`],
  ["quarantine or rejection reason missing", `SELECT COUNT(*)::int count FROM "CatalogMediaAsset" WHERE ("status"='QUARANTINED' AND "quarantineReasonCode" IS NULL) OR ("status"='REJECTED' AND "rejectionReasonCode" IS NULL)`],
  ["upload intent owner or storage mismatch", `SELECT COUNT(*)::int count FROM "CatalogMediaUploadIntent" i JOIN "CatalogMediaAsset" a ON a."id"=i."assetId" WHERE i."ownerType"<>a."ownerType" OR i."ownerStoreId" IS DISTINCT FROM a."ownerStoreId" OR i."storageKey"<>a."storageKey"`],
  ["expired active upload intent", `SELECT COUNT(*)::int count FROM "CatalogMediaUploadIntent" WHERE "status" IN ('PENDING_UPLOAD','UPLOADED') AND "expiresAt"<=CURRENT_TIMESTAMP`],
  ["invalid completion evidence", `SELECT COUNT(*)::int count FROM "CatalogMediaUploadIntent" WHERE ("status"='COMPLETED' AND ("completionCount"<>1 OR "completedAt" IS NULL)) OR ("status"<>'COMPLETED' AND "completionCount"<>0)`],
  ["published association to non-READY asset", `SELECT COUNT(*)::int count FROM "CatalogProductMedia" m JOIN "CatalogMediaAsset" a ON a."id"=m."assetId" JOIN "CatalogProduct" p ON p."id"=m."productId" WHERE a."status"<>'READY' AND p."publicationStatus"='PUBLISHED'`],
  ["cross-owner product attachment", `SELECT COUNT(*)::int count FROM "CatalogProductMedia" m JOIN "CatalogMediaAsset" a ON a."id"=m."assetId" JOIN "CatalogProduct" p ON p."id"=m."productId" WHERE (p."scope"='GLOBAL_CANONICAL' AND (a."ownerType"<>'PLATFORM' OR a."ownerStoreId" IS NOT NULL)) OR (p."scope"='STORE_PRIVATE' AND (a."ownerType"<>'STORE' OR a."ownerStoreId" IS DISTINCT FROM p."sourceStoreId"))`],
  ["variant attachment mismatch", `SELECT COUNT(*)::int count FROM "CatalogProductMedia" m JOIN "CatalogProductVariant" v ON v."id"=m."variantId" WHERE m."variantId" IS NOT NULL AND v."productId"<>m."productId"`],
  ["product primary image multiplicity", `SELECT COUNT(*)::int count FROM (SELECT "productId" FROM "CatalogProductMedia" WHERE "role"='PRIMARY' AND "variantId" IS NULL GROUP BY "productId" HAVING COUNT(*)>1) x`],
  ["invalid platform category or brand media", `SELECT ((SELECT COUNT(*) FROM "CatalogCategory" c JOIN "CatalogMediaAsset" a ON a."id"=c."imageAssetId" WHERE a."status"<>'READY' OR a."ownerType"<>'PLATFORM') + (SELECT COUNT(*) FROM "CatalogBrand" b JOIN "CatalogMediaAsset" a ON a."id"=b."logoAssetId" WHERE a."status"<>'READY' OR a."ownerType"<>'PLATFORM'))::int count`],
];

async function main() {
  const failures = [];
  for (const [label, sql] of checks) {
    const rows = await prisma.$queryRawUnsafe(sql);
    const count = Number(rows[0]?.count ?? 0);
    console.log(`${count ? "FAIL" : "PASS"}: ${label}${count ? ` (${count})` : ""}`);
    if (count) failures.push(label);
  }
  if (failures.length) throw new Error(`Catalog media integrity scan failed: ${failures.join("; ")}.`);
  console.log("Catalog media integrity scan passed. Storage-provider validation remains deferred.");
}

try { await main(); } catch (error) { console.error(error instanceof Error ? error.message : "Catalog media integrity scan failed."); process.exitCode = 1; } finally { await prisma.$disconnect(); }
