import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const actors = path.join(root, "public", "media", "public", "protagonists");
const derivatives = [
  ["protagonist-van-full-side-view-facing-left.webp", "protagonist-van-collection-side-right.webp"],
  ["protagonist-van-sliding-door-open.webp", "protagonist-van-collection-door-open-right.webp"],
];

for (const [sourceName, targetName] of derivatives) {
  const source = path.join(actors, sourceName);
  const target = path.join(actors, targetName);
  await sharp(source).flop().webp({ quality: 88, effort: 6 }).toFile(target);
  console.log(`Derived ${targetName} from ${sourceName}`);
}
