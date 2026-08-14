import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const exec = promisify(execFile);
const root = process.cwd();
const sourceDir = path.join(root, 'artifacts', 'frontend-phase2r-final', 'source');
const outputDir = path.join(root, 'public', 'media', 'kt', 'home-final');
const fontDestination = path.join(root, 'app', 'fonts', 'public', 'SchibstedGrotesk-Variable.woff2');
const unsplash = (id) => `https://images.unsplash.com/${id}?auto=format&fm=jpg&q=95&w=3000`;
const pexels = (id) => `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?cs=srgb&fm=jpg`;
const media = [
  ['commerce-world-market-film.webp', 'https://unsplash.com/photos/people-walking-through-a-busy-market-aisle-fKdUakd75kU', unsplash('photo-1778783622633-e426517de30e'), 'ONUR KURT'],
  ['commerce-threshold-flower-shop.webp', 'https://www.pexels.com/photo/woman-closing-door-into-flower-shop-5413989/', pexels('5413989'), 'Amina Filkins'],
  ['commerce-choice-produce.webp', 'https://unsplash.com/photos/hands-selecting-colorful-vegetables-and-corn-at-a-market-pbtBb5Y1C_Y', unsplash('photo-1782973048090-ac7a9a3ff39a'), 'Tho Nguyen Huu'],
  ['merchant-kitchen-preparation.webp', 'https://unsplash.com/photos/chefs-working-in-a-busy-restaurant-kitchen-dAGv2gGGj-4', unsplash('photo-1761095596618-081ea3f043a5'), 'Madeline Liu'],
  ['product-tactile-wrap.webp', 'https://unsplash.com/photos/hands-holding-a-fresh-wrap-with-visible-ingredients-adqP0dKpVEk', unsplash('photo-1760888549051-f1109fb8de8c'), 'Rodrigo Rodrigues | WOLF Λ R T'],
  ['commerce-abundance-cape-town.webp', 'https://unsplash.com/photos/green-apples-on-brown-woven-basket-JkGq84BiHm0', unsplash('photo-1581052890258-54b49cc5c644'), 'Rabia Jacobs'],
  ['commerce-handoff-market.webp', 'https://www.pexels.com/photo/merchant-giving-customer-plastic-bag-19420982/', pexels('19420982'), null],
  ['commerce-camera-shop-film.webp', 'https://unsplash.com/photos/two-men-examine-something-in-a-cluttered-shop-D72F_OPd334', unsplash('photo-1771146077110-20131ad86878'), 'Zero'],
  ['commerce-paper-bag-transfer.webp', 'https://www.pexels.com/photo/crop-seller-passing-purchases-in-paper-shopping-bags-4173174/', pexels('4173174'), 'Gustavo Fring'],
];

await Promise.all([mkdir(sourceDir, { recursive: true }), mkdir(outputDir, { recursive: true })]);
await exec('curl.exe', ['-L', '--fail', '--silent', '--show-error', '-o', fontDestination, 'https://fonts.gstatic.com/s/schibstedgrotesk/v7/Jqz55SSPQuCQF3t8uOwiUL-taUTtap9Gayo.woff2']);
const authority = [];
for (const [file, sourceUrl, downloadUrl, photographer] of media) {
  const source = path.join(sourceDir, `${file.replace(/\.webp$/, '')}-source.jpg`);
  try {
    await exec('curl.exe', ['-L', '--fail', '--silent', '--show-error', '--connect-timeout', '20', '--max-time', '120', '--retry', '2', '--retry-all-errors', '-A', 'Mozilla/5.0', '-o', source, downloadUrl]);
    const original = await sharp(source).metadata();
    const destination = path.join(outputDir, file);
    await sharp(source).rotate().resize({ width: 2600, height: 2600, fit: 'inside', withoutEnlargement: true }).webp({ quality: 88 }).toFile(destination);
    const output = await sharp(destination).metadata();
    authority.push({ file: `public/media/kt/home-final/${file}`, sourceUrl, photographer, source: { width: original.width, height: original.height, format: original.format, bytes: (await stat(source)).size }, output: { width: output.width, height: output.height, format: output.format, bytes: (await stat(destination)).size } });
  } catch (error) {
    authority.push({ file: `public/media/kt/home-final/${file}`, sourceUrl, photographer, status: 'DOWNLOAD_FAILED', reason: error instanceof Error ? error.message : String(error) });
  }
}
await writeFile(path.join(root, 'artifacts', 'frontend-phase2r-final', 'media-authority.json'), `${JSON.stringify(authority, null, 2)}\n`);
console.log(JSON.stringify(authority, null, 2));
