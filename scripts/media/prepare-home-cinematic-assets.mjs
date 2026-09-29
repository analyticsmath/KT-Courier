import { mkdir, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { cleanCinematicAlpha } from "./home-cinematic-alpha.mjs";

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const sourceRoot = path.join(repository, "public/media/public/images");
const publicRoot = path.join(repository, "public/media/public/home-cinematic");
const manifestPath = path.join(repository, "components/public-v3/home/data/home-cinematic-assets.generated.ts");
const qcPath = path.join(repository, "components/public-v3/home/data/home-cinematic-assets.qc.json");
const supported = /\.(png|webp|jpe?g)$/i;
const sequences = [
  { family: "route-van", directory: "KT_COURIER_WHITE_VAN_TOP_DOWN_SEQUENCE", prefix: "van_road_", expected: 7 },
];

async function walk(folder) {
  const entries = await readdir(folder, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(folder, entry.name);
    if (entry.isDirectory()) files.push(...await walk(full));
    else if (entry.isFile() && supported.test(entry.name)) files.push(full);
  }
  return files;
}

function sequenceNumber(file) {
  const match = path.basename(file).match(/(\d{1,3})(?=_|\.)/);
  if (!match) throw new Error(`Cannot identify sequence order: ${file}`);
  return Number(match[1]);
}

const records = [];
const ordered = {};
const byteTotals = {};
const qc = [];

async function derive(source, family, index, requireAlpha, desktopCap, mobileCap, commonCanvas) {
  const metadata = await sharp(source).metadata();
  if (!metadata.width || !metadata.height) throw new Error(`Cannot read image dimensions: ${source}`);
  if (requireAlpha && !metadata.hasAlpha) throw new Error(`Required alpha channel missing: ${source}`);
  const name = path.basename(source, path.extname(source)).toLowerCase().replace(/[^a-z0-9-]/g, "-");
  const outputFamily = family === "red-truck-top" ? "freight" : family;
  const directory = path.join(publicRoot, outputFamily);
  await mkdir(directory, { recursive: true });
  const base = `${family}-${name}`;
  const paths = [path.join(directory, `${base}-desktop.webp`), path.join(directory, `${base}-mobile.webp`)];
  const caps = [desktopCap, mobileCap];
  const canvasWidth = commonCanvas?.width ?? metadata.width;
  const canvasHeight = commonCanvas?.height ?? metadata.height;
  if (metadata.width > canvasWidth || metadata.height > canvasHeight) throw new Error(`Source exceeds sequence canvas: ${source}`);
  const leftPad = Math.floor((canvasWidth - metadata.width) / 2);
  const rightPad = canvasWidth - metadata.width - leftPad;
  const topPad = Math.floor((canvasHeight - metadata.height) / 2);
  const bottomPad = canvasHeight - metadata.height - topPad;
  const cleaned = await cleanCinematicAlpha(source, family);
  const sourceBounds = cleaned.visibleBounds;
  const relativeSource = path.relative(repository, source).replaceAll("\\", "/");
  const toPublicUrl = (file) => `/${path.relative(path.join(repository, "public"), file).replaceAll("\\", "/")}`;
  for (let i = 0; i < 2; i++) {
    let pipeline = sharp(cleaned.buffer, { raw: { width: metadata.width, height: metadata.height, channels: 4 } });
    if (leftPad || rightPad || topPad || bottomPad) pipeline = pipeline.extend({ left: leftPad, right: rightPad, top: topPad, bottom: bottomPad, background: { r: 0, g: 0, b: 0, alpha: 0 } });
    await pipeline.resize({ width: caps[i], withoutEnlargement: true }).webp({ quality: 91, alphaQuality: 100, effort: 6 }).toFile(paths[i]);
    const outputBytes = (await stat(paths[i])).size;
    const outputMeta = await sharp(paths[i]).metadata();
    const scale = outputMeta.width / canvasWidth;
    const canvasBounds = { ...sourceBounds, x: sourceBounds.x + leftPad, y: sourceBounds.y + topPad };
    byteTotals[family] = (byteTotals[family] || 0) + outputBytes;
    qc.push({
      sourcePath: relativeSource, outputPath: path.relative(repository, paths[i]).replaceAll("\\", "/"),
      sourceWidth: metadata.width, sourceHeight: metadata.height,
      outputWidth: outputMeta.width, outputHeight: outputMeta.height,
      sourceVisibleBounds: canvasBounds,
      visibleBounds: Object.fromEntries(Object.entries(canvasBounds).map(([key, value]) => [key, Math.round(value * scale)])),
      visibleAreaPercentage: cleaned.visibleAreaPercentage,
      disconnectedAlphaComponents: cleaned.disconnectedComponents,
      removedIslands: cleaned.removedIslands, removedIslandPixels: cleaned.removedIslandPixels,
      removedLowAlphaPixels: cleaned.removedLowAlpha, removedColorFringePixels: cleaned.removedColorFringe,
      outputBytes, deviceVariant: i ? "mobile" : "desktop", edgeCleanupApplied: cleaned.edgeCleanupApplied,
    });
  }
  const record = {
    id: `${family}-${String(index).padStart(2, "0")}`,
    family,
    sourceFile: relativeSource,
    desktopSrc: toPublicUrl(paths[0]),
    mobileSrc: toPublicUrl(paths[1]),
    width: canvasWidth,
    height: canvasHeight,
    sourceWidth: metadata.width,
    sourceHeight: metadata.height,
    aspectRatio: canvasWidth / canvasHeight,
    hasAlpha: Boolean(metadata.hasAlpha),
    visibleBounds: { ...sourceBounds, x: sourceBounds.x + leftPad, y: sourceBounds.y + topPad },
    index,
  };
  records.push(record);
  return record;
}

for (const sequence of sequences) {
  const folder = path.join(sourceRoot, sequence.directory);
  let candidates;
  try { candidates = (await walk(folder)).filter((file) => path.basename(file).startsWith(sequence.prefix)); }
  catch { throw new Error(`Required sequence folder absent: ${folder}`); }
  candidates.sort((a, b) => sequenceNumber(a) - sequenceNumber(b));
  if (candidates.length !== sequence.expected) throw new Error(`${sequence.family}: expected ${sequence.expected} images, found ${candidates.length} in ${folder}`);
  const numbers = candidates.map(sequenceNumber);
  for (let i = 1; i < numbers.length; i++) if (numbers[i] !== numbers[i - 1] + 1) throw new Error(`${sequence.family}: missing frame between ${candidates[i - 1]} and ${candidates[i]}`);
  const dimensions = await Promise.all(candidates.map((file) => sharp(file).metadata()));
  const ratio = dimensions[0].width / dimensions[0].height;
  for (let i = 0; i < dimensions.length; i++) {
    const item = dimensions[i];
    if (Math.abs(item.width / item.height - ratio) > .001) throw new Error(`${sequence.family}: incompatible canvas aspect ratio: ${candidates[i]}`);
  }
  const commonCanvas = sequence.output === "performance" ? { width: Math.max(...dimensions.map((item) => item.width)), height: Math.max(...dimensions.map((item) => item.height)) } : undefined;
  if (commonCanvas && dimensions.some((item) => item.width !== commonCanvas.width || item.height !== commonCanvas.height)) console.log(`${sequence.family}: preserving mixed source canvases via centered transparent padding to ${commonCanvas.width}×${commonCanvas.height}`);
  ordered[sequence.family] = [];
  for (let i = 0; i < candidates.length; i++) {
    const item = await derive(candidates[i], sequence.family, i, true, 1600, 960, commonCanvas);
    ordered[sequence.family].push(item.id);
  }
}

const topLevel = await walk(sourceRoot);
for (const [stem, family, desktopCap, mobileCap] of [["red_truck_top", "red-truck-top", 1800, 1100]]) {
  const matches = topLevel.filter((file) => path.basename(file, path.extname(file)).toLowerCase() === stem);
  if (matches.length !== 1) throw new Error(`${stem}: expected exactly one supported image, found ${matches.length}: ${matches.join(", ")}`);
  await derive(matches[0], family, 0, true, desktopCap, mobileCap);
}

const sequenceExports = Object.entries(ordered).map(([family, ids]) => `export const HOME_${family.toUpperCase().replaceAll("-", "_")}_SEQUENCE = ${JSON.stringify(ids)} as const;`).join("\n");
const source = `/* Generated by scripts/media/prepare-home-cinematic-assets.mjs. Do not edit. */\n` +
  `export type HomeCinematicAsset = { id: string; family: string; sourceFile: string; desktopSrc: string; mobileSrc: string; width: number; height: number; sourceWidth: number; sourceHeight: number; aspectRatio: number; hasAlpha: boolean; visibleBounds?: { x: number; y: number; width: number; height: number }; index: number };\n` +
  `export const HOME_CINEMATIC_ASSETS = ${JSON.stringify(records, null, 2)} as const satisfies readonly HomeCinematicAsset[];\n` +
  `${sequenceExports}\n` +
  `export const HOME_CINEMATIC_ASSET_BY_ID: Readonly<Record<string, HomeCinematicAsset>> = Object.fromEntries(HOME_CINEMATIC_ASSETS.map((asset) => [asset.id, asset]));\n`;
await mkdir(path.dirname(manifestPath), { recursive: true });
await writeFile(manifestPath, source);
const sourceInventory = [];
for (const group of ["KT_BOX_SEQUENCE_8_FRAMES", "KT_COURIER_HANDOFF_12_PNGS", "KT_Courier_White_Van_Courier_Performance_Pack", "KT_COURIER_WHITE_VAN_TOP_DOWN_SEQUENCE", "KT_Courier_20_Transparent_PNG_Assets"]) {
  for (const file of await walk(path.join(sourceRoot, group))) {
    const meta = await sharp(file).metadata();
    sourceInventory.push({ path: path.relative(repository, file).replaceAll("\\", "/"), width: meta.width, height: meta.height, hasAlpha: meta.hasAlpha });
  }
}
for (const stem of ["road", "red_truck_top"]) {
  for (const file of topLevel.filter((item) => path.basename(item, path.extname(item)).toLowerCase() === stem)) {
    const meta = await sharp(file).metadata();
    sourceInventory.push({ path: path.relative(repository, file).replaceAll("\\", "/"), width: meta.width, height: meta.height, hasAlpha: meta.hasAlpha });
  }
}
await writeFile(qcPath, JSON.stringify({ generatedAt: new Date().toISOString(), sourceInventory, assets: qc }, null, 2) + "\n");
console.log(JSON.stringify({ count: records.length, byteTotals, manifestPath }, null, 2));
