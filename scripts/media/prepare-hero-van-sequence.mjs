import { readdir, mkdir, stat, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import sharp from "sharp";

const root = resolve(import.meta.dirname, "../..");
const sourceDir = join(root, "public/media/public/images/KT_HERO_VAN_19_PNGS");
const outputDir = join(root, "public/media/public/protagonists/hero-van");
const modulePath = join(root, "components/public-v3/home/director/hero-van-sequence.generated.ts");
const alphaThreshold = 8;
const files = (await readdir(sourceDir)).filter((file) => file.toLowerCase().endsWith(".png")).sort();
if (files.length !== 19) throw new Error(`Expected 19 PNG frames, found ${files.length}`);

function alphaBounds(data, info) {
  let left = info.width;
  let top = info.height;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      if (data[(y * info.width + x) * info.channels + 3] < alphaThreshold) continue;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
    }
  }
  if (right < 0) throw new Error("Frame has no vehicle pixels");
  return { left, top, right, bottom, visibleWidth: right - left + 1, visibleHeight: bottom - top + 1, visibleCenterX: (left + right) / 2, visibleCenterY: (top + bottom) / 2 };
}

async function measuredBounds(input) {
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return alphaBounds(data, info);
}

const audited = [];
for (const [index, file] of files.entries()) {
  const match = /^(\d{3})_(\d{3})deg(?:_true_front)?\.png$/i.exec(file);
  if (!match || Number(match[1]) !== index + 1 || Number(match[2]) !== index * 5 || (index === 18) !== file.includes("true_front")) {
    throw new Error(`Unexpected frame order or yaw: ${file}`);
  }
  const path = join(sourceDir, file);
  const metadata = await sharp(path).metadata();
  if (!metadata.hasAlpha || metadata.orientation && metadata.orientation !== 1) throw new Error(`Alpha/orientation invalid: ${file}`);
  if (metadata.width * 3 !== metadata.height * 4) throw new Error(`Expected 4:3 canvas: ${file}`);
  if (audited.length && (metadata.width !== audited[0].width || metadata.height !== audited[0].height)) throw new Error(`Canvas mismatch: ${file}`);
  audited.push({ file, yaw: index * 5, width: metadata.width, height: metadata.height, bounds: await measuredBounds(path), bytes: (await stat(path)).size });
}

const { width: canvasWidth, height: canvasHeight } = audited[0];
const median = (values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
const originalBaselines = audited.map((frame) => frame.bounds.bottom / frame.height);
const originalBaselineSpread = Math.max(...originalBaselines) - Math.min(...originalBaselines);
const maxVehicleAspect = Math.max(...audited.map((frame) => frame.bounds.visibleWidth / frame.bounds.visibleHeight));
const canonicalVisibleHeight = Math.floor(Math.min(
  median(audited.map((frame) => frame.bounds.visibleHeight)),
  canvasHeight * .85,
  canvasWidth * .90 / maxVehicleAspect,
)) - 2;
const baselinePixel = Math.round(canvasHeight * .94);
if (canonicalVisibleHeight <= 0) throw new Error("Invalid canonical vehicle height");

await mkdir(outputDir, { recursive: true });
const frames = [];
for (const frame of audited) {
  const sourcePath = join(sourceDir, frame.file);
  const b = frame.bounds;
  const crop = {
    left: Math.max(0, b.left - 2),
    top: Math.max(0, b.top - 2),
    width: Math.min(canvasWidth - Math.max(0, b.left - 2), b.right - Math.max(0, b.left - 2) + 3),
    height: Math.min(canvasHeight - Math.max(0, b.top - 2), b.bottom - Math.max(0, b.top - 2) + 3),
  };
  const scale = canonicalVisibleHeight / b.visibleHeight;
  const resizedHeight = Math.round(crop.height * scale);
  let resized;
  let resizedBounds;
  // Rounding and alpha antialiasing can move the thresholded edge a pixel.
  // Pick the uniform resize that best matches the common visible height.
  for (const delta of [0, -1, 1, -2, 2, -3, 3, -4, 4]) {
    const candidate = await sharp(sourcePath).extract(crop).resize({ height: resizedHeight + delta }).png().toBuffer();
    const bounds = await measuredBounds(candidate);
    if (!resized || Math.abs(bounds.visibleHeight - canonicalVisibleHeight) < Math.abs(resizedBounds.visibleHeight - canonicalVisibleHeight)) {
      resized = candidate;
      resizedBounds = bounds;
    }
    if (bounds.visibleHeight === canonicalVisibleHeight) break;
  }
  const resizedMetadata = await sharp(resized).metadata();
  const left = Math.round(canvasWidth / 2 - resizedBounds.visibleCenterX);
  const top = baselinePixel - resizedBounds.bottom;
  if (left < 0 || top < 0 || left + resizedMetadata.width > canvasWidth || top + resizedMetadata.height > canvasHeight) {
    throw new Error(`Normalized vehicle does not fit canvas: ${frame.file}`);
  }
  const registered = await sharp({ create: { width: canvasWidth, height: canvasHeight, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: resized, left, top }]).png().toBuffer();
  const registeredBounds = await measuredBounds(registered);
  if (registeredBounds.bottom !== baselinePixel || Math.abs(registeredBounds.visibleCenterX - (canvasWidth - 1) / 2) > 1) {
    throw new Error(`Registration failed: ${frame.file}`);
  }
  const id = `yaw-${String(frame.yaw).padStart(3, "0")}`;
  const desktopSrc = `/media/public/protagonists/hero-van/${id}-desktop.webp`;
  const mobileSrc = `/media/public/protagonists/hero-van/${id}-mobile.webp`;
  const desktopWidth = Math.min(canvasWidth, frame.yaw === 90 ? 2048 : 1600);
  const mobileWidth = Math.min(canvasWidth, frame.yaw === 90 ? 1280 : 960);
  for (const [width, url, quality] of [[desktopWidth, desktopSrc, frame.yaw === 90 ? 92 : 90], [mobileWidth, mobileSrc, 90]]) {
    await sharp(registered)
      .resize({ width, height: width * 3 / 4, fit: "fill", withoutEnlargement: true })
      .webp({ quality, alphaQuality: 100, effort: 6 })
      .toFile(join(root, "public", url.slice(1)));
  }
  frames.push({ id, yaw: frame.yaw, desktopSrc, mobileSrc, sourceCanvasWidth: canvasWidth, sourceCanvasHeight: canvasHeight, aspectRatio: 4 / 3, sourceFilename: frame.file, sourceBounds: b, normalizedBounds: registeredBounds });
}

// Measure the files actually served at runtime, after WebP encoding.
const desktopBounds = await Promise.all(frames.map((frame) => measuredBounds(join(root, "public", frame.desktopSrc.slice(1)))));
const derivedBaselineSpreadPx = Math.max(...desktopBounds.map((b) => b.bottom)) - Math.min(...desktopBounds.map((b) => b.bottom));
const derivedVisibleHeight = median(desktopBounds.map((b) => b.visibleHeight));
const derivedCenterY = median(desktopBounds.map((b) => b.visibleCenterY));
const largestNormalizedWidthRatio = Math.max(...desktopBounds.map((b) => b.visibleWidth / canvasWidth));
if (derivedBaselineSpreadPx > 1) throw new Error(`Derived baseline spread ${derivedBaselineSpreadPx}px exceeds registration tolerance`);
if (largestNormalizedWidthRatio > .902) throw new Error("Normalized vehicle exceeds the safe width cap");
const generated = `/* Generated by scripts/media/prepare-hero-van-sequence.mjs. Do not edit manually. */\nexport const HERO_VAN_CANVAS_ASPECT = ${canvasWidth / canvasHeight};\nexport const HERO_VAN_VISIBLE_HEIGHT_RATIO = ${derivedVisibleHeight / canvasHeight};\nexport const HERO_VAN_BASELINE_Y = ${baselinePixel / canvasHeight};\nexport const HERO_VAN_VISIBLE_CENTER_X = 0.5;\nexport const HERO_VAN_VISIBLE_CENTER_Y = ${derivedCenterY / canvasHeight};\nexport const HERO_VAN_FRAMES = ${JSON.stringify(frames, null, 2)} as const;\nexport const HERO_VAN_SEQUENCE: readonly string[] = HERO_VAN_FRAMES.map((frame) => frame.id);\n`;
await writeFile(modulePath, generated);
const outputs = (await readdir(outputDir)).filter((file) => file.endsWith(".webp"));
if (outputs.length !== 38) throw new Error(`Expected 38 WebP derivatives, found ${outputs.length}`);
const derivedBytes = (await Promise.all(outputs.map((file) => stat(join(outputDir, file))))).reduce((sum, entry) => sum + entry.size, 0);
console.log(JSON.stringify({ sourceDir, sourceFrames: frames.length, sourceDimensions: `${canvasWidth}x${canvasHeight}`, sourceBytes: audited.reduce((sum, frame) => sum + frame.bytes, 0), originalBaselineSpreadPercent: originalBaselineSpread * 100, canonicalVisibleHeight, canonicalVisibleHeightRatio: derivedVisibleHeight / canvasHeight, normalizedBaselinePixel: baselinePixel, derivedBaselineSpreadPx, largestNormalizedWidthRatio, derivatives: outputs.length, derivedBytes }, null, 2));
