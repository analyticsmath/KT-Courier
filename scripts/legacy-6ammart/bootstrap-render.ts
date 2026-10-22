import { createHash } from "node:crypto";
import { readFile, writeFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import sharp from "sharp";
import { PrismaClient } from "@prisma/client";
import { installSystemPermissionDefaults } from "../../lib/auth/permission-bootstrap";
import { assertCatalogMediaDimensions, CATALOG_MEDIA_MAX_UPLOAD_BYTES } from "../../lib/catalog/media/catalog-media-policy";
import { decryptSource } from "./source-envelope.mjs";

const client = new PrismaClient();
const fingerprint = "ea0f3e236ac6c03d2ce30144185ee5b615de18bd24800fbc2c27e2f7673d948e";
const digest = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
function run(script: string, args: string[]) {
  const result = spawnSync(process.execPath, ["--import", "tsx", script, ...args], {
    env: process.env, stdio: "inherit", timeout: 900_000,
  });
  if (result.status !== 0) throw new Error("Migration stage failed: " + path.basename(script));
}

async function main() {
  const url = new URL(process.env.DATABASE_URL ?? "");
  if (process.env.KT_DATABASE_CLASSIFICATION !== "staging" ||
      !["ep-soft-queen-bax1woqz-pooler.c-8.eu-central-1.aws.neon.tech", "ep-soft-queen-bax1woqz.c-8.eu-central-1.aws.neon.tech"].includes(url.hostname) ||
      url.pathname !== "/kt_couriers" || process.env.KT_RENDER_LEGACY_REHEARSAL !== "true") {
    throw new Error("This bootstrap is restricted to the approved Neon preproduction database.");
  }
  if (process.env.CHECKOUT_PUBLIC_ENABLED !== "false" || process.env.WITHDRAWAL_PAYOUT_ENABLED !== "false") {
    throw new Error("Checkout and payouts must remain disabled during migration.");
  }
  const bundle = JSON.parse(decryptSource(JSON.parse(await readFile("scripts/legacy-6ammart/render-rehearsal.enc.json", "utf8")), process.env.KT_RENDER_LEGACY_SOURCE_KEY).toString("utf8"));
  if (bundle.catalog.source.dumpSha256 !== fingerprint || bundle.catalog.source.database !== "wwwktcouriers_ktcouaielidb") throw new Error("Unapproved source fingerprint.");
  const administratorSpecs = [
    { email: "private@ktcouriers.com", role: "SUPER_ADMIN" as const, key: "KT_INITIAL_SUPERADMIN_PASSWORD_HASH" },
    { email: "web@ktcouriers.com", role: "ADMIN" as const, key: "KT_INITIAL_ADMIN_PASSWORD_HASH" },
  ];
  const allowedEmails = administratorSpecs.map(x => x.email);
  const unexpected = await client.user.count({ where: { role: { in: ["SUPER_ADMIN", "ADMIN"] }, status: "ACTIVE", email: { notIn: allowedEmails } } });
  if (unexpected) throw new Error("Unreconciled administrator authority in migration target.");
  await installSystemPermissionDefaults(client);
  for (const spec of administratorSpecs) {
    const hash = process.env[spec.key] ?? "";
    if (!/^\$2[aby]\$12\$[./A-Za-z0-9]{53}$/.test(hash)) throw new Error("A protected initial administrator password hash is required.");
    const existing = await client.user.findUnique({ where: { email: spec.email } });
    if (existing && (existing.role !== spec.role || existing.status !== "ACTIVE")) throw new Error("Administrator identity requires reconciliation.");
    const user = existing ?? await client.user.create({ data: {
      email: spec.email, role: spec.role, status: "ACTIVE", passwordHash: hash,
      emailVerifiedAt: new Date(), name: spec.role === "SUPER_ADMIN" ? "KT Couriers Super Administrator" : "KT Couriers Administrator",
    } });
    await client.adminProfile.upsert({ where: { userId: user.id }, update: {}, create: { userId: user.id, displayName: user.name } });
  }
  process.env.KT_LEGACY_AUDIT_ACTOR_EMAIL = "private@ktcouriers.com";
  const directory = await mkdtemp(path.join(tmpdir(), "kt-legacy-"));
  try {
    const sourcePath = path.join(directory, "source.json");
    const manifestPath = path.join(directory, "media.json");
    await writeFile(sourcePath, JSON.stringify(bundle.catalog), { mode: 0o600 });
    const completed = await client.legacyMigrationRun.findFirst({ where: { sourceFingerprint: fingerprint, phase: "CATALOG_CORE", status: "APPLIED" } });
    if (!completed) {
      // Roll back a real database rehearsal before the first committed catalogue import.
      run("scripts/legacy-6ammart/import-catalog-core.ts", ["--source", sourcePath, "--rehearse"]);
      run("scripts/legacy-6ammart/import-catalog-core.ts", ["--source", sourcePath, "--apply"]);
      const assets = [];
      for (const original of bundle.assets) {
        const resource = new URL(original.secure_url);
        const expectedPath = `/q8gbzml2/image/upload/v${original.version}/${original.public_id}.webp`;
        if (resource.origin !== "https://res.cloudinary.com" || resource.pathname !== expectedPath || resource.search || resource.hash) throw new Error("Unapproved public media origin.");
        const response = await fetch(resource, { redirect: "error", signal: AbortSignal.timeout(30_000) });
        if (!response.ok || Number(response.headers.get("content-length") ?? 0) > CATALOG_MEDIA_MAX_UPLOAD_BYTES) throw new Error("Cloudinary retrieval failed.");
        const bytes = Buffer.from(await response.arrayBuffer());
        if (bytes.length !== original.bytes || bytes.length > CATALOG_MEDIA_MAX_UPLOAD_BYTES) throw new Error("Cloudinary size changed.");
        const metadata = await sharp(bytes, { limitInputPixels: 25_000_000 }).metadata();
        if (metadata.format !== "webp" || metadata.width !== original.width || metadata.height !== original.height) throw new Error("Cloudinary dimensions changed.");
        assertCatalogMediaDimensions(metadata.width!, metadata.height!);
        await sharp(bytes, { limitInputPixels: 25_000_000 }).raw().toBuffer();
        const checksum = digest(bytes);
        if (original.sha256 && checksum !== original.sha256) throw new Error("Previously recorded Cloudinary checksum changed.");
        const storageKey = "catalog-media/" + original.public_id.replace("kt-courier/catalog/", "") + ".webp";
        assets.push({ kind: original.kind, source_id: original.source_id, source_store_id: original.source_store_id,
          filename: original.filename, purpose: original.purpose, role: original.kind === "product" ? "PRIMARY" : null,
          normalized_width: metadata.width, normalized_height: metadata.height, normalized_bytes: bytes.length,
          checksum, storage_key: storageKey, normalized_relpath: storageKey, cloudinary_public_id: original.public_id,
          cloudinary_secure_url: original.secure_url, full_decode_verified: true });
      }
      if (assets.length !== 341) throw new Error("Reviewed media inventory is incomplete.");
      await writeFile(manifestPath, JSON.stringify({ version: 1, sourceDumpSha256: fingerprint, storageOrigin: "Cloudinary", assetCount: assets.length, assets }), { mode: 0o600 });
      run("scripts/legacy-6ammart/sync-catalog-media.ts", ["--manifest", manifestPath, "--cloudinary-existing", "--apply"]);
      run("scripts/legacy-6ammart/publish-catalog.ts", ["--source-fingerprint", fingerprint, "--apply"]);
    }
    console.log(JSON.stringify({ event: "render.legacy_catalog_verified", stores: await client.store.count(), products: await client.catalogProduct.count(), publishedProducts: await client.catalogProduct.count({ where: { publicationStatus: "PUBLISHED" } }), media: await client.catalogMediaAsset.count(), activeAdministrators: await client.user.count({ where: { role: { in: ["ADMIN", "SUPER_ADMIN"] }, status: "ACTIVE" } }) }));
  } finally { await rm(directory, { recursive: true, force: true }); }
}
main().catch(() => { console.error("Approved Neon legacy bootstrap failed; consult the preceding stage receipt."); process.exitCode = 1; }).finally(() => client.$disconnect());
