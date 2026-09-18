import { readFile, writeFile, mkdir, copyFile, stat } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const rootDir = process.cwd();
const inventoryPath = path.join(rootDir, "artifacts", "media", "media-inventory.json");
const derivedOutputDir = path.join(rootDir, "public", "media", "public", "derived");
const illustrationsOutputDir = path.join(rootDir, "public", "media", "public", "illustrations");
const protagonistsOutputDir = path.join(rootDir, "public", "media", "public", "protagonists");

const RESPONSIVE_WIDTHS = [480, 768, 1080, 1440, 1920];

async function main() {
  console.log("=== PHASE B: WEBP DERIVATION & ALPHA-QA PIPELINE ===");

  await mkdir(derivedOutputDir, { recursive: true });
  await mkdir(illustrationsOutputDir, { recursive: true });
  await mkdir(protagonistsOutputDir, { recursive: true });

  const inventoryRaw = await readFile(inventoryPath, "utf8");
  const inventory = JSON.parse(inventoryRaw);

  const approvedAssets = inventory.filter((item) => item.approvedForRuntime);
  console.log(`Processing ${approvedAssets.length} runtime-approved assets...`);

  let derivedCount = 0;
  let alphaCount = 0;
  let vectorCount = 0;

  for (let i = 0; i < approvedAssets.length; i++) {
    const asset = approvedAssets[i];
    const sourceFullPath = path.join(rootDir, asset.sourcePath);
    const ext = path.extname(asset.filename).toLowerCase();
    const isSvg = ext === ".svg";
    const isProtagonist = asset.semanticRole.startsWith("protagonist-");

    if (isSvg) {
      // SVGs stay pure vectors
      const destName = asset.filename;
      const destPath = path.join(illustrationsOutputDir, destName);
      await copyFile(sourceFullPath, destPath);
      asset.runtimePaths = {
        vector: `/media/public/illustrations/${destName}`,
      };
      vectorCount++;
      continue;
    }

    if (isProtagonist) {
      // Protagonist transparent cutouts (Trucks, Van, Courier)
      // Save pristine PNG in protagonists dir
      const cleanStem = asset.id.replace(/\./g, "-");
      const pngDestName = `${cleanStem}.png`;
      const pngDestPath = path.join(protagonistsOutputDir, pngDestName);
      await copyFile(sourceFullPath, pngDestPath);

      // Generate Alpha-capable WebP derivative
      const webpDestName = `${cleanStem}.webp`;
      const webpDestPath = path.join(protagonistsOutputDir, webpDestName);

      const sourceImage = sharp(sourceFullPath);
      await sourceImage
        .clone()
        .webp({ quality: 92, alphaQuality: 100, lossless: false, effort: 6 })
        .toFile(webpDestPath);

      // Verify alpha channel preservation
      const webpMeta = await sharp(webpDestPath).metadata();
      const hasAlphaVerified = Boolean(webpMeta.hasAlpha);

      asset.runtimePaths = {
        masterPng: `/media/public/protagonists/${pngDestName}`,
        webp: `/media/public/protagonists/${webpDestName}`,
        hasAlphaVerified,
      };

      alphaCount++;
      derivedCount++;
      continue;
    }

    // Photographic assets (Commerce, Route, About, etc.)
    const cleanStem = asset.id.replace(/\./g, "-");
    asset.runtimePaths = {};

    const availableWidths = RESPONSIVE_WIDTHS.filter((w) => w <= asset.width * 1.05);
    if (availableWidths.length === 0) {
      availableWidths.push(asset.width);
    }

    for (const w of availableWidths) {
      const outFileName = `${cleanStem}-${w}w.webp`;
      const outFilePath = path.join(derivedOutputDir, outFileName);

      await sharp(sourceFullPath)
        .rotate()
        .resize({ width: w, withoutEnlargement: true, fit: "inside" })
        .webp({ quality: 88, effort: 5 })
        .toFile(outFilePath);

      asset.runtimePaths[`w${w}`] = `/media/public/derived/${outFileName}`;
    }

    // Default primary WebP path (largest available width)
    const primaryWidth = availableWidths[availableWidths.length - 1];
    asset.runtimePaths.primary = asset.runtimePaths[`w${primaryWidth}`];

    derivedCount++;
  }

  // Save updated inventory with runtime paths
  await writeFile(inventoryPath, JSON.stringify(inventory, null, 2), "utf8");
  console.log(`Derived ${derivedCount} photographic/protagonist assets and copied ${vectorCount} vector SVGs.`);
  console.log(`Alpha-QA completed for ${alphaCount} protagonist cutouts (both pristine PNG and alpha WebP emitted).`);
  console.log(`Updated inventory written to: ${inventoryPath}`);
}

main().catch((err) => {
  console.error("Failed to derive media:", err);
  process.exit(1);
});
