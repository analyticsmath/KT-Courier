import { readdir, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const rootDir = process.cwd();
const sourceRoot = path.join(rootDir, "public", "media", "public", "images");
const outputDir = path.join(rootDir, "artifacts", "media", "contact-sheets", "homepage-actor-audit");
const packs = [
  {
    family: "van",
    folder: "KT_Courier_Van_Asset_Pack_14_PNGs",
    include: (name) => /^KT_Courier_Van_(?:0[1-9]|1[0-6])\.png$/i.test(name),
  },
  {
    family: "red-truck",
    folder: "truck_asset_pack_12_images",
    include: (name) => /^R(?:0[1-9]|1[0-2])_[^.]+\.png$/i.test(name),
  },
  {
    family: "human-candidates",
    folder: "KT_Courier_20_Transparent_PNG_Assets",
    include: (name) => !/^\d{2}_/.test(name),
  },
];

function svgLabel(text, width, height) {
  const safe = text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  return Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#f6f3ed"/><text x="12" y="30" font-family="Arial, sans-serif" font-size="15" fill="#222">${safe}</text></svg>`);
}

async function makeSheet(family, records, index, columns = 4) {
  const tileWidth = 420;
  const imageHeight = 260;
  const labelHeight = 42;
  const tileHeight = imageHeight + labelHeight;
  const rows = Math.ceil(records.length / columns);
  const tiles = await Promise.all(records.map(async (record, tileIndex) => {
    const sourcePath = path.join(sourceRoot, record.folder, record.file);
    const x = (tileIndex % columns) * tileWidth;
    const y = Math.floor(tileIndex / columns) * tileHeight;
    const image = await sharp(sourcePath)
      .resize(tileWidth - 24, imageHeight - 18, { fit: "contain", background: { r: 232, g: 228, b: 219, alpha: 1 } })
      .flatten({ background: { r: 232, g: 228, b: 219 } })
      .png()
      .toBuffer();
    return [
      { input: image, left: x + 12, top: y + 9 },
      { input: svgLabel(`${record.file}  ·  ${record.width}×${record.height}${record.hasAlpha ? " · alpha" : ""}`, tileWidth - 12, labelHeight), left: x + 6, top: y + imageHeight },
    ];
  }));
  const composites = tiles.flat();
  const outputPath = path.join(outputDir, `${family}${index ? `-${index}` : ""}.png`);
  await sharp({
    create: {
      width: columns * tileWidth,
      height: rows * tileHeight,
      channels: 3,
      background: { r: 232, g: 228, b: 219 },
    },
  }).composite(composites).png().toFile(outputPath);
  return outputPath;
}

await mkdir(outputDir, { recursive: true });
const audit = [];
for (const pack of packs) {
  const folderPath = path.join(sourceRoot, pack.folder);
  const files = (await readdir(folderPath)).filter(pack.include).sort((a, b) => a.localeCompare(b, "en", { numeric: true }));
  const records = [];
  for (const file of files) {
    const filePath = path.join(folderPath, file);
    const metadata = await sharp(filePath).metadata();
    if (!metadata.width || !metadata.height) throw new Error(`Missing dimensions: ${filePath}`);
    records.push({ family: pack.family, folder: pack.folder, file, width: metadata.width, height: metadata.height, hasAlpha: Boolean(metadata.hasAlpha) });
  }
  audit.push(...records);
  if (pack.family === "human-candidates") {
    for (let offset = 0, sheetIndex = 1; offset < records.length; offset += 12, sheetIndex += 1) {
      await makeSheet(pack.family, records.slice(offset, offset + 12), sheetIndex, 4);
    }
  } else {
    await makeSheet(pack.family, records, 0, 4);
  }
  console.log(`${pack.family}: ${records.length} source PNGs inspected`);
}
await writeFile(path.join(outputDir, "source-metadata.json"), `${JSON.stringify(audit, null, 2)}\n`, "utf8");
console.log(`Contact sheets and metadata written to ${outputDir}`);
