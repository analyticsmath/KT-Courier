import { copyFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const sourceDir = path.join(root, "artifacts", "kt-art-direction", "source");
const outputDir = path.join(root, "public", "media", "kt", "home-v4");
const workDir = path.join(root, "artifacts", "frontend-phase2c", "source");

const assets = [
  { id: "A01", file: "a01-commerce-world.webp", source: "W02-world-market-light-source.jpg", sourcePage: "https://www.pexels.com/photo/street-market-scene-with-natural-light-rays-35129786/", author: "Pexels contributor (Gate A trace)" },
  { id: "A02", file: "a02-commerce-threshold.webp", source: "W04-world-flower-shop-source.jpg", sourcePage: "https://www.pexels.com/photo/woman-closing-door-into-flower-shop-5413989/", author: "Pexels contributor (Gate A trace)" },
  { id: "A03", file: "a03-cape-town-merchant.webp", url: "https://images.pexels.com/photos/36508145/pexels-photo-36508145.jpeg?cs=srgb&fm=jpg", sourcePage: "https://www.pexels.com/photo/creative-artisan-crafting-handmade-products-36508145/", author: "Filipp Romanovski" },
  { id: "A04", file: "a04-product-tactile.webp", source: "P01-product-fresh-wrap-source.jpg", sourcePage: "https://unsplash.com/photos/hands-holding-a-fresh-wrap-with-visible-ingredients-adqP0dKpVEk", author: "Unsplash contributor (Gate A trace)" },
  { id: "A05", file: "a05-commerce-handoff.webp", source: "H01-handoff-shopping-bag-source.jpg", sourcePage: "https://www.pexels.com/photo/man-handing-over-a-shopping-bag-to-a-customer-7667454/", author: "Pexels contributor (Gate A trace)" },
  { id: "A06", file: "a06-commerce-in-motion.webp", url: "https://images.unsplash.com/photo-1770622006147-0561289d5bb2?auto=format&fit=crop&fm=jpg&ixlib=rb-4.1.0&q=88&w=3000", sourcePage: "https://unsplash.com/photos/woman-with-shopping-bag-crossing-street-with-blurred-cars-hJin_QyGKlY", author: "Jadon Johnson" },
  { id: "A07", file: "a07-cape-town-abundance.webp", source: "P02-product-green-apples-source.jpg", sourcePage: "https://unsplash.com/photos/green-apples-on-brown-woven-basket-JkGq84BiHm0", author: "Unsplash contributor (Gate A trace)" },
  { id: "A08", file: "a08-craft-discovery.webp", url: "https://images.unsplash.com/photo-1772374997335-970d67909d52?auto=format&fit=crop&fm=jpg&ixlib=rb-4.1.0&q=88&w=3000", sourcePage: "https://unsplash.com/photos/customers-browsing-handmade-crafts-in-a-shop-U4GPLNFNpv8", author: "Jason Leung" },
];

await mkdir(outputDir, { recursive: true });
await mkdir(workDir, { recursive: true });

for (const asset of assets) {
  const input = path.join(workDir, asset.file.replace(/\.webp$/, ".source.jpg"));
  if (asset.source) await copyFile(path.join(sourceDir, asset.source), input);
  else {
    const response = await fetch(asset.url);
    if (!response.ok) throw new Error(`${asset.id} download failed: ${response.status}`);
    await writeFile(input, Buffer.from(await response.arrayBuffer()));
  }
  const output = path.join(outputDir, asset.file);
  await sharp(input).rotate().resize({ width: 2600, height: 2600, fit: "inside", withoutEnlargement: true }).webp({ quality: 88, effort: 6 }).toFile(output);
}

console.log(`Built ${assets.length} exact Phase 2C WebP assets in ${outputDir}`);
