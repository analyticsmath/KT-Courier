import { mkdir, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const sourceRoot = path.join(repository, "public/media/public/images");
const publicRoot = path.join(repository, "public/media/public/home-cinematic");
const manifestPath = path.join(repository, "components/public-v3/home/data/home-cinematic-assets.generated.ts");
const supported = /\.(png|webp|jpe?g)$/i;
const sequences = [
  { family: "box", directory: "KT_BOX_SEQUENCE_8_FRAMES", prefix: "box_", expected: 8 },
  { family: "route-van", directory: "KT_COURIER_WHITE_VAN_TOP_DOWN_SEQUENCE", prefix: "van_road_", expected: 7 },
  { family: "handoff", directory: "KT_COURIER_HANDOFF_12_PNGS", prefix: "handoff_", expected: 12 },
  { family: "pickup", directory: "KT_Courier_White_Van_Courier_Performance_Pack", prefix: "pickup_A", expected: 17, output: "performance" },
  { family: "delivery", directory: "KT_Courier_White_Van_Courier_Performance_Pack", prefix: "delivery_B", expected: 12, output: "performance" },
  { family: "return", directory: "KT_Courier_White_Van_Courier_Performance_Pack", prefix: "return_C", expected: 7, output: "performance" },
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

async function alphaBounds(source, width, height) {
  const { data, info } = await sharp(source).extractChannel("alpha").raw().toBuffer({ resolveWithObject: true });
  let left = width, top = height, right = -1, bottom = -1;
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      if (data[y * info.width + x] <= 8) continue;
      if (x < left) left = x;
      if (x > right) right = x;
      if (y < top) top = y;
      if (y > bottom) bottom = y;
    }
  }
  if (right < left) throw new Error(`Transparent image has no visible pixels: ${source}`);
  return { x: left, y: top, width: right - left + 1, height: bottom - top + 1 };
}

const records = [];
const ordered = {};
const byteTotals = {};

async function derive(source, family, index, requireAlpha, desktopCap, mobileCap, commonCanvas) {
  const metadata = await sharp(source).metadata();
  if (!metadata.width || !metadata.height) throw new Error(`Cannot read image dimensions: ${source}`);
  if (requireAlpha && !metadata.hasAlpha) throw new Error(`Required alpha channel missing: ${source}`);
  const name = path.basename(source, path.extname(source)).toLowerCase().replace(/[^a-z0-9-]/g, "-");
  const outputFamily = ["pickup", "delivery", "return"].includes(family) ? "performance" : family === "road" ? "environment" : family === "red-truck-top" ? "freight" : family;
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
  for (let i = 0; i < 2; i++) {
    let pipeline = sharp(source);
    if (leftPad || rightPad || topPad || bottomPad) pipeline = pipeline.extend({ left: leftPad, right: rightPad, top: topPad, bottom: bottomPad, background: { r: 0, g: 0, b: 0, alpha: 0 } });
    await pipeline.resize({ width: caps[i], withoutEnlargement: true }).webp({ quality: 91, alphaQuality: 100, effort: 6 }).toFile(paths[i]);
    byteTotals[family] = (byteTotals[family] || 0) + (await stat(paths[i])).size;
  }
  const relativeSource = path.relative(repository, source).replaceAll("\\", "/");
  const toPublicUrl = (file) => `/${path.relative(path.join(repository, "public"), file).replaceAll("\\", "/")}`;
  const sourceBounds = metadata.hasAlpha ? await alphaBounds(source, metadata.width, metadata.height) : undefined;
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
    ...(sourceBounds ? { visibleBounds: { ...sourceBounds, x: sourceBounds.x + leftPad, y: sourceBounds.y + topPad } } : {}),
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
for (const [stem, family, desktopCap, mobileCap] of [["road", "road", 2400, 1440], ["red_truck_top", "red-truck-top", 1800, 1100]]) {
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
console.log(JSON.stringify({ count: records.length, byteTotals, manifestPath }, null, 2));
