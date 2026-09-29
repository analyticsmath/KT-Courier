import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { cleanCinematicAlpha } from "./home-cinematic-alpha.mjs";

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const sourceRoot = path.join(repository, "public/media/public/images");
const outputRoot = path.join(repository, "public/media/public/home-cinematic/composed");
const manifestPath = path.join(repository, "components/public-v3/home/data/home-composed-actors.generated.ts");
const qcPath = path.join(repository, "components/public-v3/home/data/home-cinematic-assets.qc.json");
await mkdir(outputRoot, { recursive: true });

const vanPack = "KT_Courier_White_Van_Courier_Performance_Pack";
const personPack = "KT_Courier_20_Transparent_PNG_Assets";
const handoffPack = "KT_COURIER_HANDOFF_12_PNGS";
const vanCrop = { left: 180, top: 540, width: 1520, height: 910 };
const recipes = [
  { id: "van-open-right", file: `${vanPack}/pickup_A05_door_open.png`, family: "van", crop: vanCrop },
  { id: "van-door-right", file: `${vanPack}/pickup_A00_van_closed_right.png`, family: "van", crop: vanCrop, keep: { left: 755, top: 730, right: 1115, bottom: 1315 } },
  { id: "van-open-left", file: `${vanPack}/delivery_B05_door_open.png`, family: "van", crop: vanCrop },
  { id: "van-door-left", file: `${vanPack}/delivery_B00_van_closed_left.png`, family: "van", crop: vanCrop, keep: { left: 830, top: 730, right: 1190, bottom: 1315 } },
  { id: "courier-carry-right", file: `${personPack}/10_looking_right_approaching_vehicle.png`, family: "courier" },
  { id: "courier-load", file: `${personPack}/18_loading_unloading_parcel.png`, family: "courier" },
  { id: "courier-empty", file: `${personPack}/16_empty_hands_courier_hero.png`, family: "courier" },
  { id: "courier-carry-left", file: `${personPack}/11_looking_left_approaching_vehicle.png`, family: "courier" },
  { id: "courier-walk-right", file: `${personPack}/04_walking_one_parcel_facing_right.png`, family: "courier" },
  { id: "courier-walk-left", file: `${personPack}/05_walking_one_parcel_facing_left.png`, family: "courier" },
  { id: "recipient-ready", file: `${handoffPack}/handoff_01_approach.png`, family: "recipient", crop: { left: 650, top: 0, width: 604, height: 1254 } },
  { id: "recipient-reach", file: `${handoffPack}/handoff_03_recipient_reach.png`, family: "recipient", crop: { left: 650, top: 0, width: 604, height: 1254 } },
  { id: "recipient-carry", file: `${handoffPack}/handoff_12_final_separation.png`, family: "recipient", crop: { left: 650, top: 0, width: 604, height: 1254 } },
];

const qc = JSON.parse(await readFile(qcPath, "utf8"));
qc.assets = qc.assets.filter((asset) => !asset.outputPath.includes("/composed/"));
const assets = [];
for (const recipe of recipes) {
  const source = path.join(sourceRoot, recipe.file);
  const clean = await cleanCinematicAlpha(source, recipe.family);
  const raw = clean.buffer;
  const crop = recipe.crop ?? { left: 0, top: 0, width: clean.width, height: clean.height };
  const extracted = Buffer.alloc(crop.width * crop.height * 4);
  let minX = crop.width, minY = crop.height, maxX = -1, maxY = -1, visible = 0;
  for (let y = 0; y < crop.height; y++) for (let x = 0; x < crop.width; x++) {
    const sourceX = crop.left + x, sourceY = crop.top + y;
    const sourceAt = (sourceY * clean.width + sourceX) * 4;
    const destAt = (y * crop.width + x) * 4;
    if (recipe.keep && (sourceX < recipe.keep.left || sourceX >= recipe.keep.right || sourceY < recipe.keep.top || sourceY >= recipe.keep.bottom)) continue;
    const a = raw[sourceAt + 3];
    if (!a) continue;
    raw.copy(extracted, destAt, sourceAt, sourceAt + 4);
    visible++;
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
  }
  if (!visible) throw new Error(`Composed actor is empty: ${recipe.id}`);
  const visibleBounds = { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
  const urls = {};
  for (const [variant, cap] of [["desktop", recipe.family === "van" ? 1400 : 800], ["mobile", recipe.family === "van" ? 960 : 560]]) {
    const output = path.join(outputRoot, `${recipe.id}-${variant}.webp`);
    await sharp(extracted, { raw: { width: crop.width, height: crop.height, channels: 4 } }).resize({ width: cap, withoutEnlargement: true }).webp({ quality: 91, alphaQuality: 100, effort: 6 }).toFile(output);
    const outputMeta = await sharp(output).metadata();
    const scale = outputMeta.width / crop.width;
    const outputPath = path.relative(repository, output).replaceAll("\\", "/");
    urls[variant] = `/${path.relative(path.join(repository, "public"), output).replaceAll("\\", "/")}`;
    qc.assets.push({
      sourcePath: `public/media/public/images/${recipe.file}`, outputPath,
      sourceWidth: clean.width, sourceHeight: clean.height,
      outputWidth: outputMeta.width, outputHeight: outputMeta.height,
      sourceVisibleBounds: visibleBounds,
      visibleBounds: Object.fromEntries(Object.entries(visibleBounds).map(([key, value]) => [key, Math.round(value * scale)])),
      visibleAreaPercentage: Number((visible / (crop.width * crop.height) * 100).toFixed(3)),
      disconnectedAlphaComponents: clean.disconnectedComponents,
      removedIslands: clean.removedIslands, removedIslandPixels: clean.removedIslandPixels,
      removedLowAlphaPixels: clean.removedLowAlpha, removedColorFringePixels: clean.removedColorFringe,
      outputBytes: (await stat(output)).size, deviceVariant: variant,
      edgeCleanupApplied: clean.edgeCleanupApplied,
    });
  }
  assets.push({ id: recipe.id, family: recipe.family, sourceFile: `public/media/public/images/${recipe.file}`, ...urls, width: crop.width, height: crop.height, visibleBounds });
}
await writeFile(qcPath, JSON.stringify(qc, null, 2) + "\n");
await writeFile(manifestPath, `/* Generated by scripts/media/prepare-home-composite-actors.mjs. Do not edit. */\nexport const HOME_COMPOSED_ACTORS = ${JSON.stringify(assets, null, 2)} as const;\nexport const HOME_COMPOSED_ACTOR_BY_ID: Readonly<Record<string, (typeof HOME_COMPOSED_ACTORS)[number]>> = Object.fromEntries(HOME_COMPOSED_ACTORS.map((asset) => [asset.id, asset]));\n`);
console.log(`Generated ${assets.length} independent actor states and ${assets.length * 2} variants.`);
