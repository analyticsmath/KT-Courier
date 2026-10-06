import { readFile, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { assertLegacyApplyAllowed } from "../../lib/migrations/legacy-6ammart/target-policy";

function arg(name: string): string {
  const index = process.argv.indexOf(name);
  if (index < 0 || !process.argv[index + 1]) throw new Error(name + " is required.");
  return process.argv[index + 1];
}
function run(script: string, args: string[], expectedSuccess = true) {
  const result = spawnSync(process.execPath, ["--import", "tsx", script, ...args], { encoding: "utf8", timeout: 900_000, env: process.env });
  if ((result.status === 0) !== expectedSuccess) throw new Error("Rehearsal command failed: " + script + "\n" + result.stderr);
  return result;
}
async function main() {
  assertLegacyApplyAllowed();
  if (process.env.KT_DATABASE_CLASSIFICATION !== "staging" || new URL(process.env.DATABASE_URL!).pathname !== "/kt_legacy_staging") {
    throw new Error("Rehearsal is restricted to the dedicated kt_legacy_staging database.");
  }
  const sourcePath = arg("--source"), manifestPath = arg("--manifest"), mediaDir = arg("--media-dir"), output = arg("--out");
  const source = JSON.parse(await readFile(sourcePath, "utf8"));
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  if (source.source.dumpSha256 !== manifest.sourceDumpSha256) throw new Error("Source/media fingerprints differ.");
  const client = new PrismaClient();
  try {
    const catalogCount = await client.catalogProduct.count();
    const migrationCount = await client.legacyMigrationRun.count();
    if (catalogCount || migrationCount || await client.user.count()) throw new Error("Full rehearsal requires a fresh migrated staging database.");

    // Real persistence test: an existing account must never be converted to STORE.
    const storeVendorIds = new Set(source.tables.stores
      .filter((store: { name: string }) => !/(^|\b)(test|demo|sample|do not use)(\b|$)/i.test(store.name))
      .map((store: { vendor_id: number }) => store.vendor_id));
    const vendor = source.tables.vendors.find((v: { id: number; email?: string }) => v.email && storeVendorIds.has(v.id));
    if (!vendor) throw new Error("No vendor identity available for the collision test.");
    const fixture = await client.user.create({ data: { email: vendor.email.trim().toLowerCase(), name: "Staging collision fixture", role: "CUSTOMER", status: "ACTIVE", passwordHash: null } });
    const rejection = run("scripts/legacy-6ammart/import-catalog-core.ts", ["--source", sourcePath, "--apply"], false);
    if (!rejection.stderr.includes("Unreconciled identity collision")) throw new Error("Identity collision was not the reason for rejection.");
    const unchanged = await client.user.findUniqueOrThrow({ where: { id: fixture.id } });
    if (unchanged.role !== "CUSTOMER" || unchanged.status !== "ACTIVE" || await client.store.count() || await client.legacyMigrationRun.count()) throw new Error("Collision attempt changed target authority.");
    await client.user.delete({ where: { id: fixture.id } });

    const coreArgs = ["--source", sourcePath, "--apply"];
    run("scripts/legacy-6ammart/import-catalog-core.ts", coreArgs);
    async function ids() {
      return {
        stores: (await client.store.findMany({ select: { id: true }, orderBy: { id: "asc" } })).map(r => r.id),
        products: (await client.catalogProduct.findMany({ select: { id: true }, orderBy: { id: "asc" } })).map(r => r.id),
        variants: (await client.catalogProductVariant.findMany({ select: { id: true }, orderBy: { id: "asc" } })).map(r => r.id),
        offers: (await client.storeCatalogOffer.findMany({ select: { id: true }, orderBy: { id: "asc" } })).map(r => r.id),
      };
    }
    const first = await ids();
    run("scripts/legacy-6ammart/import-catalog-core.ts", coreArgs);
    if (JSON.stringify(first) !== JSON.stringify(await ids())) throw new Error("Core rerun changed target IDs.");
    const mediaArgs = ["--manifest", manifestPath, "--media-dir", mediaDir, "--apply"];
    run("scripts/legacy-6ammart/sync-catalog-media.ts", mediaArgs);
    run("scripts/legacy-6ammart/sync-catalog-media.ts", mediaArgs);
    const publishArgs = ["--source-fingerprint", source.source.dumpSha256, "--apply"];
    run("scripts/legacy-6ammart/publish-catalog.ts", publishArgs);
    const snapshots = await client.catalogPublicationSnapshot.count();
    run("scripts/legacy-6ammart/publish-catalog.ts", publishArgs);
    run("scripts/legacy-6ammart/import-catalog-core.ts", coreArgs);
    if (snapshots !== await client.catalogPublicationSnapshot.count() || JSON.stringify(first) !== JSON.stringify(await ids())) throw new Error("Publication/core rerun changed immutable IDs or snapshot count.");
    const report = {
      status: "PASSED", sourceFingerprint: source.source.dumpSha256,
      coreIdempotency: true, publicationIdempotency: true, identityCollisionPreserved: true,
      stores: first.stores.length, products: first.products.length, variants: first.variants.length,
      offers: first.offers.length, media: await client.catalogMediaAsset.count(), snapshots,
      publishedProducts: await client.catalogProduct.count({ where: { publicationStatus: "PUBLISHED" } }),
      publicDocuments: await client.storefrontProductDocument.count({ where: { status: "ACTIVE" } }),
      legacyPasswordsCopied: await client.user.count({ where: { role: "STORE", passwordHash: { not: null } } }),
    };
    const expectedPublished = manifest.assets.filter((asset: { kind: string; role?: string }) => asset.kind === "product" && asset.role === "PRIMARY").length;
    if (report.media !== manifest.assetCount || report.legacyPasswordsCopied || report.publishedProducts !== expectedPublished || report.publicDocuments !== report.snapshots) throw new Error("Post-publication reconciliation failed.");
    await writeFile(output, JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report));
  } finally { await client.$disconnect(); }
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; });
