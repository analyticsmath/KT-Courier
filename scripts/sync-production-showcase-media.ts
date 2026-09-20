import { createHash } from "node:crypto";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { createProductionCatalogMediaStorageAdapter } from "../lib/catalog/media/catalog-media-storage-adapter";
import { DEMO_MEDIA_MANIFEST } from "./demo/media/manifest";

const prisma = new PrismaClient();

function assertAuthorized(): void {
  if (process.env.NODE_ENV !== "production") throw new Error("Production media sync requires NODE_ENV=production.");
  if (process.env.KT_DATABASE_CLASSIFICATION?.trim().toLowerCase() !== "production") {
    throw new Error("Production media sync requires KT_DATABASE_CLASSIFICATION=production.");
  }
  if (process.env.KT_PRODUCTION_SHOWCASE_CATALOG_SEED !== "true") {
    throw new Error("Production media sync requires explicit one-time catalogue authorization.");
  }
  if (process.env.CATALOG_MEDIA_STORAGE?.trim().toLowerCase() !== "s3") {
    throw new Error("Production media sync requires CATALOG_MEDIA_STORAGE=s3.");
  }
}

async function readAsset(storageKey: string, checksum: string): Promise<Uint8Array> {
  const stripped = storageKey.replace(/^catalog-media\//, "");
  const candidates = [
    path.join(process.cwd(), "var", "catalog-media", stripped),
    path.join(process.cwd(), "var", "catalog-media", `${stripped}.webp`),
    path.join(process.cwd(), "var", "catalog-media", checksum),
    path.join(process.cwd(), "var", "catalog-media", `${checksum}.webp`),
  ];
  for (const candidate of candidates) {
    try {
      return new Uint8Array(await readFile(candidate));
    } catch {
      // Try the next immutable source path.
    }
  }
  throw new Error(`Bundled catalogue media bytes are missing for ${storageKey}.`);
}

async function seededDuringThisPredeploy(): Promise<boolean> {
  try {
    await access("/tmp/kt-showcase-catalog-seeded-now");
    return true;
  } catch {
    return false;
  }
}

async function main(): Promise<void> {
  assertAuthorized();
  const storage = createProductionCatalogMediaStorageAdapter();
  if (!storage.productionReady) throw new Error("Production catalog S3 adapter is not configured.");

  const manifestReferences = DEMO_MEDIA_MANIFEST.map((entry) => entry.publicReference);
  const readyExistingAssets = await prisma.catalogMediaAsset.count({
    where: {
      publicReference: { in: manifestReferences },
      status: "READY",
      privacyInspectionPassed: true,
      storageProvider: "S3_COMPATIBLE",
    },
  });
  const seededNow = await seededDuringThisPredeploy();

  // Normal application deploys must never rewrite already-trusted immutable media.
  // Uploading is reserved for the same pre-deploy container that just bootstrapped
  // an empty catalogue. Existing production data is therefore deployment-stable.
  if (!seededNow && readyExistingAssets >= DEMO_MEDIA_MANIFEST.length) {
    console.log(JSON.stringify({
      event: "production_catalog_media_existing",
      ready: readyExistingAssets,
      skippedUpload: true,
    }));
    return;
  }
  if (!seededNow && readyExistingAssets > 0) {
    throw new Error(
      `Production catalogue media is partially initialized (ready=${readyExistingAssets}); refusing to rewrite immutable media during an application deploy.`,
    );
  }

  let cursor = 0;
  const concurrency = 12;
  const workers = Array.from({ length: concurrency }, async () => {
    while (true) {
      const index = cursor++;
      if (index >= DEMO_MEDIA_MANIFEST.length) return;
      const entry = DEMO_MEDIA_MANIFEST[index]!;
      const bytes = await readAsset(entry.storageKey, entry.checksum);
      if (bytes.byteLength !== entry.byteSize) {
        throw new Error(`Media size mismatch for ${entry.publicReference}.`);
      }
      const digest = createHash("sha256").update(bytes).digest("hex");
      if (digest !== entry.checksum) {
        throw new Error(`Media checksum mismatch for ${entry.publicReference}.`);
      }

      await storage.confirmUpload({
        storageKey: entry.storageKey,
        bytes,
        maximumBytes: entry.byteSize,
      });

      const roundTrip = await storage.openForValidation({
        storageKey: entry.storageKey,
        maximumBytes: entry.byteSize,
      });
      const roundTripDigest = createHash("sha256").update(roundTrip).digest("hex");
      if (roundTrip.byteLength !== entry.byteSize || roundTripDigest !== entry.checksum) {
        throw new Error(`S3 round-trip verification failed for ${entry.publicReference}.`);
      }

    }
  });

  await Promise.all(workers);

  const ready = await prisma.catalogMediaAsset.count({
    where: { status: "READY", privacyInspectionPassed: true, storageProvider: "S3_COMPATIBLE" },
  });
  if (ready < DEMO_MEDIA_MANIFEST.length) {
    throw new Error(`Production media verification failed: expected at least ${DEMO_MEDIA_MANIFEST.length} ready S3 assets, found ${ready}.`);
  }
  console.log(JSON.stringify({ event: "production_catalog_media_ready", uploaded: DEMO_MEDIA_MANIFEST.length, ready }));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : "Production catalog media sync failed.");
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
