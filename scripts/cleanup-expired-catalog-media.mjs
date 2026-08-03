import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const CATALOG_MEDIA_PRODUCTION_VALIDATION_APPROVED = false;
const execute = process.argv.includes("--execute");
const batchArgument = process.argv.find((argument) => argument.startsWith("--batch="));
const requestedBatch = batchArgument ? Number(batchArgument.slice("--batch=".length)) : 100;
const batchSize = Number.isSafeInteger(requestedBatch) ? Math.min(Math.max(requestedBatch, 1), 500) : 100;

async function main() {
  const [expiredIntents, rejectedUnattached, orphanedMetadata, missingStorageEvidence] = await Promise.all([
    prisma.catalogMediaUploadIntent.findMany({ where: { status: { in: ["PENDING_UPLOAD", "UPLOADED"] }, expiresAt: { lte: new Date() } }, take: batchSize, orderBy: { expiresAt: "asc" }, select: { publicReference: true, asset: { select: { publicReference: true } } } }),
    prisma.catalogMediaAsset.findMany({ where: { status: "REJECTED", productMedia: { none: {} }, optionValues: { none: {} }, categoryImages: { none: {} }, brandLogos: { none: {} } }, take: batchSize, orderBy: { updatedAt: "asc" }, select: { publicReference: true } }),
    prisma.catalogMediaAsset.findMany({ where: { uploadIntents: { none: {} }, productMedia: { none: {} }, optionValues: { none: {} }, categoryImages: { none: {} }, brandLogos: { none: {} }, status: { in: ["PENDING_UPLOAD", "REJECTED"] } }, take: batchSize, orderBy: { createdAt: "asc" }, select: { publicReference: true } }),
    prisma.catalogMediaAsset.findMany({ where: { status: { in: ["UPLOADED", "VALIDATING", "READY"] }, OR: [{ storageConfirmedAt: null }, { byteSize: null }] }, take: batchSize, orderBy: { updatedAt: "asc" }, select: { publicReference: true, status: true } }),
  ]);
  const report = { mode: execute ? "EXECUTE_REQUESTED" : "DRY_RUN", batchSize, expiredUploadIntents: expiredIntents.length, rejectedUnattachedAssets: rejectedUnattached.length, orphanedMetadata: orphanedMetadata.length, missingStorageEvidence: missingStorageEvidence.length, attachedAssetsDeleted: 0, historicalEvidenceDeleted: 0, providerObjectsDeleted: 0 };
  console.log(JSON.stringify(report, null, 2));
  if (!execute) { console.log("Dry run only. No database row or storage object was changed."); return; }
  if (!CATALOG_MEDIA_PRODUCTION_VALIDATION_APPROVED) throw new Error("Catalog media cleanup is source-locked: CONSOLIDATED_VALIDATION_NOT_APPROVED. No records were changed.");
  throw new Error("Catalog media cleanup requires a reviewed production storage adapter before execution. No records were changed.");
}

try { await main(); } catch (error) { console.error(error instanceof Error ? error.message : "Catalog media cleanup failed safely."); process.exitCode = 1; } finally { await prisma.$disconnect(); }
