import { mkdir, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import sharp from "sharp";

const workspaceRoot = path.resolve(import.meta.dirname, "..", "..");
const sourceRoot = path.join(workspaceRoot, "public", "images", "kt-couriers", "provisional", "r2");
const outputRoot = path.join(workspaceRoot, "public", "images", "kt-couriers", "provisional", "r4");

/**
 * R4 media derivatives are deliberately local and deterministic. This script
 * never downloads assets, changes source files, removes backgrounds, or uses
 * inferred crops. Every crop is calculated from the focal point recorded here.
 *
 * Run: node scripts/public-v2/process-r4-media.mjs
 */
const jobs = [
  {
    source: "hero/r2-hero-01-truck.webp",
    output: "hero/r4-truck-desktop.webp",
    width: 1600,
    height: 1067,
    focalPoint: [0.5, 0.58],
  },
  {
    source: "hero/r2-hero-01-truck.webp",
    output: "hero/r4-truck-tablet.webp",
    width: 1320,
    height: 990,
    focalPoint: [0.52, 0.58],
  },
  {
    source: "hero/r2-hero-01-truck.webp",
    output: "hero/r4-truck-mobile.webp",
    width: 920,
    height: 1100,
    focalPoint: [0.53, 0.58],
  },
  {
    source: "coverage/r2-cov-01-road-network.webp",
    output: "hero/r4-environment-desktop.webp",
    width: 2000,
    height: 1000,
    focalPoint: [0.57, 0.62],
  },
  {
    source: "coverage/r2-cov-01-road-network.webp",
    output: "hero/r4-environment-tablet.webp",
    width: 1500,
    height: 1000,
    focalPoint: [0.55, 0.62],
  },
  {
    source: "coverage/r2-cov-01-road-network.webp",
    output: "hero/r4-environment-mobile.webp",
    width: 920,
    height: 1120,
    focalPoint: [0.56, 0.62],
  },
  {
    source: "coverage/r2-cov-01-road-network.webp",
    output: "coverage/r4-coverage-mobile.webp",
    width: 960,
    height: 1040,
    focalPoint: [0.55, 0.63],
  },
];

function calculateCrop({ width, height }, targetWidth, targetHeight, [focalX, focalY]) {
  const targetRatio = targetWidth / targetHeight;
  const sourceRatio = width / height;
  const cropWidth = sourceRatio > targetRatio ? Math.round(height * targetRatio) : width;
  const cropHeight = sourceRatio > targetRatio ? height : Math.round(width / targetRatio);
  const desiredLeft = Math.round(width * focalX - cropWidth / 2);
  const desiredTop = Math.round(height * focalY - cropHeight / 2);

  return {
    left: Math.max(0, Math.min(width - cropWidth, desiredLeft)),
    top: Math.max(0, Math.min(height - cropHeight, desiredTop)),
    width: cropWidth,
    height: cropHeight,
  };
}

async function createDerivative(job) {
  const inputPath = path.resolve(sourceRoot, job.source);
  const outputPath = path.resolve(outputRoot, job.output);

  if (!inputPath.startsWith(`${sourceRoot}${path.sep}`)) {
    throw new Error(`Refusing source outside the R2 media root: ${job.source}`);
  }

  if (!outputPath.startsWith(`${outputRoot}${path.sep}`)) {
    throw new Error(`Refusing output outside the R4 media root: ${job.output}`);
  }

  if (inputPath === outputPath) {
    throw new Error(`Refusing to overwrite a source master: ${job.source}`);
  }

  const metadata = await sharp(inputPath).metadata();
  if (!metadata.width || !metadata.height) {
    throw new Error(`Unable to inspect source dimensions: ${job.source}`);
  }

  if (job.width > metadata.width || job.height > metadata.height) {
    throw new Error(`Refusing to upscale ${job.source} to ${job.width}×${job.height}`);
  }

  const crop = calculateCrop(metadata, job.width, job.height, job.focalPoint);
  await mkdir(path.dirname(outputPath), { recursive: true });
  await sharp(inputPath)
    .extract(crop)
    .resize(job.width, job.height, { fit: "fill", withoutEnlargement: true })
    .webp({ quality: 84, effort: 6, smartSubsample: true })
    .toFile(outputPath);

  const outputMetadata = await sharp(outputPath).metadata();
  const outputStat = await stat(outputPath);
  console.log(
    `${job.output}: ${outputMetadata.width}×${outputMetadata.height} WebP, ${outputStat.size.toLocaleString("en-US")} B ← ${job.source} crop ${crop.left},${crop.top} ${crop.width}×${crop.height}`
  );
}

await Promise.all(jobs.map(createDerivative));
