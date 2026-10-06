import { createHash } from "node:crypto";
import { readFile, mkdir, writeFile, realpath } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { assertCatalogMediaDimensions, CATALOG_MEDIA_MAX_UPLOAD_BYTES } from "../../lib/catalog/media/catalog-media-policy";

function arg(name: string) {
  const value = process.argv[process.argv.indexOf(name) + 1];
  if (!process.argv.includes(name) || !value) throw new Error(name + " is required.");
  return value;
}

async function main() {
// Consume the reviewed admission manifest; normalization cannot admit new media.
const selection = JSON.parse(await readFile(arg("--selection"), "utf8"));
const originalRoot = await realpath(arg("--original-dir"));
const outputRoot = path.resolve(arg("--output-dir"));
const result = [];
for (const asset of selection.assets) {
  const family = asset.kind === "product" ? "product" : asset.kind.startsWith("store-") ? "store" : asset.kind;
  if (!["product", "store", "category", "brand"].includes(family) || path.basename(asset.filename) !== asset.filename) {
    throw new Error("Invalid catalogue source path.");
  }
  const originalPath = await realpath(path.join(originalRoot, "public", family, ...(asset.kind === "store-hero" ? ["cover"] : []), asset.filename));
  if (!originalPath.startsWith(originalRoot + path.sep)) throw new Error("Source path escapes media root.");
  const bytes = await readFile(originalPath);
  const metadata = await sharp(bytes, { limitInputPixels: 25_000_000 }).metadata();
  if (!metadata.width || !metadata.height || bytes.length !== asset.original_bytes || metadata.width !== asset.original_width || metadata.height !== asset.original_height) {
    throw new Error("Reviewed source media changed: " + asset.filename);
  }
  // Full decode, metadata stripping, no cropping or invented product imagery.
  const output = await sharp(bytes, { limitInputPixels: 25_000_000 })
    .resize(asset.normalized_width, asset.normalized_height, { fit: "fill" })
    .webp({ quality: 86, effort: 6 }).toBuffer();
  assertCatalogMediaDimensions(asset.normalized_width, asset.normalized_height);
  if (output.length > CATALOG_MEDIA_MAX_UPLOAD_BYTES) throw new Error("Normalized media exceeds catalogue limit.");
  const checksum = createHash("sha256").update(output).digest("hex");
  const basename = `${asset.kind}-${asset.source_id}-${checksum.slice(0, 16)}`;
  const relative = `${asset.kind}/${basename}.webp`;
  const file = path.join(outputRoot, relative);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, output);
  result.push({ ...asset, normalized_bytes: output.length, checksum,
    original_checksum: createHash("sha256").update(bytes).digest("hex"),
    normalized_relpath: relative, storage_key: `catalog-media/legacy-6ammart/${relative}`,
    cloudinary_public_id: `kt-courier/catalog/legacy-6ammart/${asset.kind}/${basename}` });
}
await writeFile(arg("--out"), JSON.stringify({ version: 1, sourceDumpSha256: selection.sourceDumpSha256, assetCount: result.length, assets: result }, null, 2));
console.log(JSON.stringify({ normalizedAssets: result.length, bytes: result.reduce((n, a) => n + a.normalized_bytes, 0) }));

}
main().catch((error) => { console.error(error.message); process.exitCode = 1; });
