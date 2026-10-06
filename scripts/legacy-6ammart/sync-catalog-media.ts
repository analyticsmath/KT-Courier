import { assertLegacyApplyAllowed } from "../../lib/migrations/legacy-6ammart/target-policy";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { Prisma, PrismaClient } from "@prisma/client";
import {
  assertCatalogMediaDimensions,
  CATALOG_MEDIA_MAX_UPLOAD_BYTES,
} from "../../lib/catalog/media/catalog-media-policy";
import { createProductionCatalogMediaStorageAdapter } from "../../lib/catalog/media/catalog-media-storage-adapter";
import { legacyReferences } from "../../lib/migrations/legacy-6ammart/catalog-policy";

type NormalizedAsset = Readonly<{
  kind: "product" | "store-logo" | "store-hero" | "category" | "brand";
  source_id: number;
  source_store_id?: number | null;
  filename: string;
  purpose:
    | "PRODUCT_IMAGE"
    | "STORE_LOGO"
    | "STORE_HERO"
    | "CATEGORY_IMAGE"
    | "BRAND_LOGO";
  role?: "PRIMARY" | null;
  normalized_width: number;
  normalized_height: number;
  normalized_bytes: number;
  checksum: string;
  storage_key: string;
  cloudinary_public_id: string;
  normalized_relpath: string;
}>;

type NormalizedManifest = Readonly<{
  version: number;
  sourceDumpSha256: string;
  assetCount: number;
  assets: readonly NormalizedAsset[];
}>;

const rootClient = new PrismaClient();
let prisma: Prisma.TransactionClient = rootClient;

function arg(name: string): string | null {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] ?? null : null;
}

function hasFlag(name: string): boolean {
  return process.argv.includes(name);
}

function required(value: string | null, label: string): string {
  if (!value?.trim()) throw new Error(label + " is required.");
  return value.trim();
}

function mediaReference(asset: NormalizedAsset): string {
  return legacyReferences.media(
    asset.kind.replace(/_/g, "-"),
    asset.source_id,
    0,
  );
}

function sourceTable(asset: NormalizedAsset): string {
  if (asset.kind === "product") return "items";
  if (asset.kind === "category") return "categories";
  if (asset.kind === "brand") return "brands";
  return "stores";
}

function sourceTargetModel(asset: NormalizedAsset): string {
  if (asset.kind === "product") return "CatalogProduct";
  if (asset.kind === "category") return "CatalogCategory";
  if (asset.kind === "brand") return "CatalogBrand";
  return "Store";
}

async function findTarget(asset: NormalizedAsset, runId: string) {
  const mapping = await prisma.legacyMigrationMap.findFirst({
    where: {
      runId,
      sourceSystem: "LEGACY_6AMMART",
      sourceDatabase: "wwwktcouriers_ktcouaielidb",
      sourceTable: sourceTable(asset),
      sourceId: String(asset.source_id),
      targetModel: sourceTargetModel(asset),
    },
    orderBy: { createdAt: "desc" },
  });
  if (!mapping) {
    throw new Error(
      `Missing migration mapping for ${asset.kind} source ${asset.source_id}.`,
    );
  }
  return mapping;
}

async function main() {
  const manifestPath = required(arg("--manifest"), "--manifest");
  const mediaDir = required(arg("--media-dir"), "--media-dir");
  const apply = hasFlag("--apply");

  if (apply) assertLegacyApplyAllowed();

  const manifestBytes = await readFile(manifestPath, "utf8");
  const manifestFingerprint = createHash("sha256").update(manifestBytes).digest("hex");
  const manifest = JSON.parse(manifestBytes) as NormalizedManifest;
  if (
    manifest.version !== 1 ||
    !/^[a-f0-9]{64}$/.test(manifest.sourceDumpSha256) ||
    manifest.assetCount !== manifest.assets.length
  ) {
    throw new Error("Normalized legacy media manifest is invalid.");
  }

  const run = await prisma.legacyMigrationRun.findFirst({
    where: {
      sourceSystem: "LEGACY_6AMMART",
      sourceDatabase: "wwwktcouriers_ktcouaielidb",
      sourceFingerprint: manifest.sourceDumpSha256,
      phase: "CATALOG_CORE",
    },
    orderBy: { createdAt: "desc" },
  });
  if (!run || !["VALIDATED", "APPLIED"].includes(run.status)) {
    throw new Error(
      "Catalogue core migration must be validated before media synchronization.",
    );
  }

  if (run.sourceMediaFingerprint && run.sourceMediaFingerprint !== manifestFingerprint) throw new Error("Migration media manifest changed after synchronization.");

  const storage = createProductionCatalogMediaStorageAdapter();
  if (!storage.productionReady) {
    throw new Error("Canonical production catalogue storage is not configured.");
  }

  let verified = 0;
  const planned: Array<{
    asset: NormalizedAsset;
    bytes: Uint8Array;
    targetId: string;
    ownerStoreId: string | null;
    ownerType: "PLATFORM" | "STORE";
  }> = [];

  for (const asset of manifest.assets) {
    const filePath = path.resolve(mediaDir, asset.normalized_relpath);
    const relative = path.relative(path.resolve(mediaDir), filePath);
    if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) throw new Error("Media path escapes migration root.");
    const bytes = new Uint8Array(await readFile(filePath));
    if (
      bytes.byteLength < 1 ||
      bytes.byteLength > CATALOG_MEDIA_MAX_UPLOAD_BYTES ||
      bytes.byteLength !== asset.normalized_bytes
    ) {
      throw new Error(`Media byte-size mismatch: ${asset.normalized_relpath}`);
    }

    const checksum = createHash("sha256").update(bytes).digest("hex");
    if (checksum !== asset.checksum) {
      throw new Error(`Media checksum mismatch: ${asset.normalized_relpath}`);
    }

    const metadata = await sharp(Buffer.from(bytes)).metadata();
    const width = metadata.width ?? 0;
    const height = metadata.height ?? 0;
    if (
      metadata.format !== "webp" ||
      width !== asset.normalized_width ||
      height !== asset.normalized_height
    ) {
      throw new Error(
        `Media metadata mismatch: ${asset.normalized_relpath}`,
      );
    }
    assertCatalogMediaDimensions(width, height);
    await sharp(Buffer.from(bytes), { limitInputPixels: 25_000_000 }).raw().toBuffer();

    const target = await findTarget(asset, run.id);
    let ownerStoreId: string | null = null;
    let ownerType: "PLATFORM" | "STORE" = "PLATFORM";

    if (asset.kind === "product") {
      const product = await prisma.catalogProduct.findUniqueOrThrow({
        where: { id: target.targetId },
        select: { sourceStoreId: true },
      });
      if (!product.sourceStoreId) {
        throw new Error(
          `Legacy product ${asset.source_id} has no migrated source store.`,
        );
      }
      ownerStoreId = product.sourceStoreId;
      ownerType = "STORE";
    } else if (asset.kind === "store-logo" || asset.kind === "store-hero") {
      ownerStoreId = target.targetId;
      ownerType = "STORE";
    }

    planned.push({ asset, bytes, targetId: target.targetId, ownerStoreId, ownerType });
  }

  if (!apply) {
    console.log(
      JSON.stringify(
        {
          mode: "dry-run",
          sourceFingerprint: manifest.sourceDumpSha256,
          assets: planned.length,
          bytes: planned.reduce((sum, row) => sum + row.bytes.byteLength, 0),
        },
        null,
        2,
      ),
    );
    return;
  }

  for (const row of planned) {
    await rootClient.$transaction(async (tx) => {
      prisma = tx;
      const { asset, bytes } = row;
      const publicReference = mediaReference(asset);

      const existing = await prisma.catalogMediaAsset.findUnique({
        where: { publicReference },
      });
      if (existing) {
        const drift = [
          existing.storageKey !== asset.storage_key ? "storageKey" : null,
          existing.checksum !== asset.checksum ? "checksum" : null,
          existing.byteSize !== asset.normalized_bytes ? "byteSize" : null,
          existing.width !== asset.normalized_width ? "width" : null,
          existing.height !== asset.normalized_height ? "height" : null,
          existing.purpose !== asset.purpose ? "purpose" : null,
          existing.ownerStoreId !== row.ownerStoreId ? "ownerStoreId" : null,
          existing.status !== "READY" ? "status" : null,
          !existing.privacyInspectionPassed ? "privacy" : null,
        ].filter(Boolean);
        if (drift.length > 0) {
          throw new Error(
            `Immutable legacy media drift for ${publicReference}: ${drift.join(", ")}`,
          );
        }
      } else {
        await storage.confirmUpload({
          storageKey: asset.storage_key,
          bytes,
          maximumBytes: asset.normalized_bytes,
        });

        const roundTrip = await storage.openForValidation({
          storageKey: asset.storage_key,
          maximumBytes: asset.normalized_bytes,
        });
        const roundTripChecksum = createHash("sha256")
          .update(roundTrip)
          .digest("hex");
        if (
          roundTrip.byteLength !== asset.normalized_bytes ||
          roundTripChecksum !== asset.checksum
        ) {
          throw new Error(
            `Canonical storage round-trip failed for ${publicReference}.`,
          );
        }

        await prisma.catalogMediaAsset.create({
          data: {
            publicReference,
            ownerType: row.ownerType,
            ownerStoreId: row.ownerStoreId,
            purpose: asset.purpose,
            storageKey: asset.storage_key,
            storageProvider: "S3_COMPATIBLE",
            declaredMimeType: "image/webp",
            mimeType: "image/webp",
            declaredByteSize: asset.normalized_bytes,
            byteSize: asset.normalized_bytes,
            width: asset.normalized_width,
            height: asset.normalized_height,
            checksum: asset.checksum,
            privacyInspectionPassed: true,
            validationSummary: {
              sourceSystem: "LEGACY_6AMMART",
              sourceFilename: asset.filename,
              normalized: true,
              cloudinaryPublicId: asset.cloudinary_public_id,
            },
            status: "READY",
            storageConfirmedAt: new Date(),
            validatedAt: new Date(),
            createdByUserId: run.createdByUserId ?? "legacy-migration",
            updatedByUserId: run.createdByUserId ?? "legacy-migration",
          },
        });
      }

      // Verify canonical bytes on reruns as well as on initial upload.
      const canonical = await storage.openForValidation({ storageKey: asset.storage_key, maximumBytes: asset.normalized_bytes });
      if (canonical.byteLength !== asset.normalized_bytes || createHash("sha256").update(canonical).digest("hex") !== asset.checksum) {
        throw new Error("Canonical media integrity failed: " + publicReference);
      }
      const media = await prisma.catalogMediaAsset.findUniqueOrThrow({
        where: { publicReference },
      });

      if (asset.kind === "product") {
        const currentPrimary = await prisma.catalogProductMedia.findFirst({
          where: { productId: row.targetId, role: "PRIMARY" },
        });
        if (currentPrimary && currentPrimary.assetId !== media.id) {
          throw new Error(
            `Product ${asset.source_id} already has a different PRIMARY asset.`,
          );
        }
        if (!currentPrimary) {
          const product = await prisma.catalogProduct.findUniqueOrThrow({
            where: { id: row.targetId },
            select: { title: true },
          });
          await prisma.catalogProductMedia.create({
            data: {
              productId: row.targetId,
              assetId: media.id,
              role: "PRIMARY",
              altText: product.title,
              displayOrder: 1,
            },
          });
        }
      } else if (asset.kind === "category") {
        await prisma.catalogCategory.update({
          where: { id: row.targetId },
          data: { imageAssetId: media.id },
        });
      } else if (asset.kind === "brand") {
        await prisma.catalogBrand.update({
          where: { id: row.targetId },
          data: { logoAssetId: media.id },
        });
      }

      await prisma.legacyMigrationMap.upsert({
        where: {
          sourceSystem_sourceDatabase_sourceTable_sourceId_targetModel: {
            sourceSystem: "LEGACY_6AMMART",
            sourceDatabase: "wwwktcouriers_ktcouaielidb",
            sourceTable: "media:" + asset.kind,
            sourceId: String(asset.source_id),
            targetModel: "CatalogMediaAsset",
          },
        },
        update: {
          runId: run.id,
          sourceHash: asset.checksum,
          disposition: "READY",
          targetId: media.id,
          targetPublicReference: publicReference,
          safeMetadata: {
            sourceFilename: asset.filename,
            cloudinaryPublicId: asset.cloudinary_public_id,
          },
        },
        create: {
          runId: run.id,
          sourceSystem: "LEGACY_6AMMART",
          sourceDatabase: "wwwktcouriers_ktcouaielidb",
          sourceTable: "media:" + asset.kind,
          sourceId: String(asset.source_id),
          sourceHash: asset.checksum,
          disposition: "READY",
          targetModel: "CatalogMediaAsset",
          targetId: media.id,
          targetPublicReference: publicReference,
          safeMetadata: {
            sourceFilename: asset.filename,
            cloudinaryPublicId: asset.cloudinary_public_id,
          },
        },
      });

      verified += 1;
    }, { timeout: 60_000, maxWait: 10_000 });
    prisma = rootClient;
  }

  await prisma.legacyMigrationRun.update({
    where: { id: run.id },
    data: {
      sourceMediaFingerprint: manifestFingerprint,
      summary: {
        ...(run.summary && typeof run.summary === "object" ? run.summary : {}),
        mediaReady: verified,
      },
    },
  });

  console.log(
    JSON.stringify(
      {
        mode: "apply",
        mediaReady: verified,
        sourceFingerprint: manifest.sourceDumpSha256,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(
      error instanceof Error ? error.message : "Legacy catalogue media sync failed.",
    );
    process.exitCode = 1;
  })
  .finally(() => rootClient.$disconnect());
