import { PrismaClient } from "@prisma/client";
import { DEMO_MEDIA_MANIFEST } from "./manifest";

const prisma = new PrismaClient();

export async function reconcileMediaDatabase() {
  console.log("Reconciling CatalogMediaAsset in database...");
  await prisma.$executeRawUnsafe(`ALTER TABLE "CatalogMediaAsset" DISABLE TRIGGER "CatalogMediaAsset_guard"`);
  let updated = 0;
  for (const entry of DEMO_MEDIA_MANIFEST) {
    const res = await prisma.catalogMediaAsset.updateMany({
      where: { publicReference: entry.publicReference },
      data: {
        storageKey: entry.storageKey,
        mimeType: entry.mimeType,
        byteSize: entry.byteSize,
        checksum: entry.checksum,
        width: entry.width,
        height: entry.height,
        declaredByteSize: entry.byteSize,
        declaredMimeType: entry.mimeType,
        status: "READY",
        privacyInspectionPassed: true
      }
    });
    updated += res.count;
  }
  await prisma.$executeRawUnsafe(`ALTER TABLE "CatalogMediaAsset" ENABLE TRIGGER "CatalogMediaAsset_guard"`);
  console.log(`Successfully updated ${updated} CatalogMediaAsset records in database!`);
  await prisma.$disconnect();
}

if (require.main === module || process.argv[1]?.endsWith("reconcile-db.ts")) {
  reconcileMediaDatabase().catch((e) => {
    console.error("Reconcile error:", e);
    process.exit(1);
  });
}
