/**
 * KT Couriers — Demo Media Integrity Validator
 * Reads DEMO_MEDIA_MANIFEST, decodes every WebP file using Sharp,
 * verifies byte lengths and SHA-256 checksums match manifest and filesystem.
 */

import fs from "fs";
import path from "path";
import crypto from "crypto";
import sharp from "sharp";
import { DEMO_MEDIA_MANIFEST } from "./manifest";

export async function verifyCatalogMediaIntegrity(): Promise<{ verifiedCount: number; errors: string[] }> {
  console.log(`[MediaVerify] Verifying ${DEMO_MEDIA_MANIFEST.length} catalog media assets...`);
  const errors: string[] = [];
  let count = 0;

  for (const entry of DEMO_MEDIA_MANIFEST) {
    const publicPath = path.join(process.cwd(), "public", "demo-media", entry.relativePath);
    const storagePath = path.join(process.cwd(), "var", "catalog-media", `${entry.checksum}.webp`);

    if (!fs.existsSync(publicPath)) {
      errors.push(`Public file missing: ${entry.relativePath}`);
      continue;
    }
    if (!fs.existsSync(storagePath)) {
      errors.push(`Storage file missing for ${entry.publicReference} (${entry.checksum}.webp)`);
      continue;
    }

    const buf = fs.readFileSync(publicPath);
    const hash = crypto.createHash("sha256").update(buf).digest("hex");
    if (hash !== entry.checksum) {
      errors.push(`Checksum mismatch for ${entry.publicReference}: expected ${entry.checksum}, got ${hash}`);
      continue;
    }

    if (buf.length !== entry.byteSize) {
      errors.push(`Byte size mismatch for ${entry.publicReference}: expected ${entry.byteSize}, got ${buf.length}`);
      continue;
    }

    // Decode with Sharp
    try {
      const meta = await sharp(buf).metadata();
      if (meta.format !== "webp") {
        errors.push(`Format mismatch for ${entry.publicReference}: expected webp, got ${meta.format}`);
      }
      if (meta.width !== entry.width || meta.height !== entry.height) {
        errors.push(`Dimension mismatch for ${entry.publicReference}: expected ${entry.width}x${entry.height}, got ${meta.width}x${meta.height}`);
      }
    } catch (e: any) {
      errors.push(`Sharp decode failed for ${entry.publicReference}: ${e?.message || e}`);
    }

    count++;
  }

  if (errors.length === 0) {
    console.log(`[MediaVerify] SUCCESS: All ${count} media assets verified byte-for-byte with Sharp.`);
  } else {
    console.error(`[MediaVerify] FAILED with ${errors.length} errors.`);
  }

  return { verifiedCount: count, errors };
}

if (require.main === module || process.argv[1]?.endsWith("verify.ts")) {
  verifyCatalogMediaIntegrity().then(res => {
    if (res.errors.length > 0) process.exit(1);
  });
}
