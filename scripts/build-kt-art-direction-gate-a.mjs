import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, copyFile, writeFile, stat, rm } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const run = promisify(execFile);
const root = process.cwd();
const artifacts = path.join(root, 'artifacts', 'kt-art-direction');
const paths = {
  source: path.join(artifacts, 'source'), previews: path.join(artifacts, 'previews'),
  native: path.join(artifacts, 'crops', 'native'), wide: path.join(artifacts, 'crops', 'wide'),
  portrait: path.join(artifacts, 'crops', 'portrait'), mobile: path.join(artifacts, 'crops', 'mobile'),
  square: path.join(artifacts, 'crops', 'square'), sheets: path.join(artifacts, 'contact-sheets'),
  metadata: path.join(artifacts, 'metadata'), public: path.join(root, 'public', 'media', 'kt', 'home-v3'),
};

const pexels = (id) => `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?cs=srgb&fm=jpg`;
const unsplash = (id) => `https://images.unsplash.com/${id}?auto=format&fm=jpg&q=95&w=3000`;
const candidate = (id, group, basename, sourceUrl, provider, downloadUrl, photographer = null, location = null) => ({ id, group, basename, sourceUrl, provider, downloadUrl, photographer, location });
const candidates = [
  candidate('W01', 'WORLD', 'world-bakery-queue', 'https://www.pexels.com/photo/busy-bakery-queue-with-customers-indoors-36522639/', 'Pexels', pexels('36522639'), 'Yasin Onuş'),
  candidate('W02', 'WORLD', 'world-market-light', 'https://www.pexels.com/photo/street-market-scene-with-natural-light-rays-35129786/', 'Pexels', pexels('35129786'), 'Md Abdul High Sharif Sujon'),
  candidate('W03', 'WORLD', 'world-bakery-shadow', 'https://www.pexels.com/photo/woman-in-a-bakery-in-shadow-22667946/', 'Pexels', pexels('22667946'), 'Ezgi Kaya'),
  candidate('W04', 'WORLD', 'world-flower-shop', 'https://www.pexels.com/photo/woman-closing-door-into-flower-shop-5413989/', 'Pexels', pexels('5413989'), 'Amina Filkins'),
  candidate('D01', 'DISCOVERY', 'discovery-bakery-counter', 'https://www.pexels.com/photo/cozy-bakery-counter-with-pastries-and-customer-32345014/', 'Pexels', pexels('32345014'), 'Alec Doualetas'),
  candidate('D02', 'DISCOVERY', 'discovery-flowers-conversation', 'https://www.pexels.com/photo/flowers-looking-indoors-conversation-6720594/', 'Pexels', pexels('6720594'), 'Gustavo Fring'),
  candidate('D03', 'DISCOVERY', 'discovery-bookstore', 'https://www.pexels.com/photo/customer-in-bookstore-16933586/', 'Pexels', pexels('16933586'), 'Sultan Çiftçi'),
  candidate('D04', 'DISCOVERY', 'discovery-market-vegetables', 'https://unsplash.com/photos/hands-selecting-colorful-vegetables-and-corn-at-a-market-pbtBb5Y1C_Y', 'Unsplash', unsplash('photo-1782973048090-ac7a9a3ff39a'), 'Tho Nguyen Huu'),
  candidate('M01', 'MERCHANT', 'merchant-busy-kitchen', 'https://unsplash.com/photos/chefs-working-in-a-busy-restaurant-kitchen-dAGv2gGGj-4', 'Unsplash', unsplash('photo-1761095596618-081ea3f043a5'), 'Madeline Liu'),
  candidate('M02', 'MERCHANT', 'merchant-restaurant-kitchen', 'https://unsplash.com/photos/woman-working-in-a-restaurant-kitchen-Dx2ze80gMrA', 'Unsplash', unsplash('photo-1762113246607-4299ec3f3214'), 'Roman'),
  candidate('M03', 'MERCHANT', 'merchant-barista-cups', 'https://unsplash.com/photos/barista-working-in-a-coffee-shop-with-cups-in-focus-cups-bxv42hDEq7I', 'Unsplash', unsplash('photo-1770215963085-ed709d3caa93'), 'Willian Justen de Vasconcellos', 'Hong Kong'),
  candidate('M04', 'MERCHANT', 'merchant-florist-shop', 'https://www.pexels.com/photo/florist-arranging-flowers-in-a-sunlit-shop-interior-30000215/', 'Pexels', pexels('30000215'), 'Felix Young'),
  candidate('P01', 'PRODUCT_MATERIAL', 'product-fresh-wrap', 'https://unsplash.com/photos/hands-holding-a-fresh-wrap-with-visible-ingredients-adqP0dKpVEk', 'Unsplash', unsplash('photo-1760888549051-f1109fb8de8c'), 'Rodrigo Rodrigues | WOLF Λ R T'),
  candidate('P02', 'PRODUCT_MATERIAL', 'product-green-apples', 'https://unsplash.com/photos/green-apples-on-brown-woven-basket-JkGq84BiHm0', 'Unsplash', unsplash('photo-1581052890258-54b49cc5c644'), 'Rabia Jacobs', 'Oranjezicht City Farm Market, Granger Bay Boulevard, Victoria & Alfred Waterfront, Cape Town, South Africa'),
  candidate('H01', 'HANDOFF', 'handoff-shopping-bag', 'https://www.pexels.com/photo/man-handing-over-a-shopping-bag-to-a-customer-7667454/', 'Pexels', pexels('7667454'), 'MART PRODUCTION'),
  candidate('H02', 'HANDOFF', 'handoff-merchant-plastic-bag', 'https://www.pexels.com/photo/merchant-giving-customer-plastic-bag-19420982/', 'Pexels', pexels('19420982')),
  candidate('H03', 'HANDOFF', 'handoff-market-counter', 'https://www.pexels.com/photo/interaction-at-a-busy-market-counter-29462804/', 'Pexels', pexels('29462804')),
  candidate('H04', 'HANDOFF', 'handoff-brown-shopping-bags', 'https://www.pexels.com/photo/a-man-receiving-brown-shopping-bags-6613914/', 'Pexels', pexels('6613914')),
];

const output = (dir, item, suffix = '') => path.join(dir, `${item.id}-${item.basename}${suffix}.webp`);
const previewSpecs = [
  ['native', paths.native, null, 'NATIVE'], ['wide', paths.wide, { width: 1800, height: 1125 }, 'WIDE 16:10'],
  ['portrait', paths.portrait, { width: 1200, height: 1500 }, 'PORTRAIT 4:5'], ['mobile', paths.mobile, { width: 900, height: 1600 }, 'MOBILE 9:16'],
  ['square', paths.square, { width: 1000, height: 1000 }, 'SQUARE 1:1'],
];

async function download(item, destination) {
  try {
    const existing = await sharp(destination).metadata();
    if (existing.width && existing.height) return existing;
  } catch {
    await rm(destination, { force: true });
  }
  await run('curl.exe', ['-L', '--fail', '--silent', '--show-error', '--connect-timeout', '20', '--max-time', '120', '--retry', '2', '--retry-all-errors', '-A', 'Mozilla/5.0', '-o', destination, item.downloadUrl]);
  const sourceMeta = await sharp(destination).metadata();
  if (!sourceMeta.width || !sourceMeta.height) throw new Error('Downloaded file is not a decodable image.');
  return sourceMeta;
}

async function makeDerivative(source, destination, spec) {
  const image = sharp(source).rotate();
  if (!spec) return image.resize({ width: 2000, height: 2000, fit: 'inside', withoutEnlargement: true }).webp({ quality: 88 }).toFile(destination);
  return image.resize({ ...spec, fit: 'cover', position: sharp.strategy.attention, withoutEnlargement: true }).webp({ quality: 88 }).toFile(destination);
}

function labelSvg(id, dimensions, crop, width, height) {
  const safe = (text) => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;');
  return Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#f4f4f2"/><text x="20" y="28" font-family="Arial, sans-serif" font-size="20" font-weight="700" fill="#171717">${safe(id)}</text><text x="20" y="53" font-family="Arial, sans-serif" font-size="15" fill="#555">${safe(dimensions)}</text><text x="20" y="76" font-family="Arial, sans-serif" font-size="15" fill="#555">${safe(crop)}</text></svg>`);
}

async function contactSheet(filename, items, crop, columns = 4) {
  const tileW = 440, imageH = 300, labelH = 92, gap = 20, pad = 28;
  const rows = Math.ceil(items.length / columns);
  const canvasW = pad * 2 + columns * tileW + (columns - 1) * gap;
  const canvasH = pad * 2 + rows * (imageH + labelH) + (rows - 1) * gap;
  const composites = [];
  for (let index = 0; index < items.length; index += 1) {
    const { item, sourceWidth, sourceHeight } = items[index];
    const row = Math.floor(index / columns), column = index % columns;
    const left = pad + column * (tileW + gap), top = pad + row * (imageH + labelH + gap);
    const imagePath = crop === 'native' ? output(paths.native, item) : output(paths[crop], item);
    composites.push({ input: await sharp(imagePath).resize(tileW, imageH, { fit: 'cover', position: sharp.strategy.attention }).jpeg({ quality: 90 }).toBuffer(), left, top });
    composites.push({ input: labelSvg(item.id, `${sourceWidth} × ${sourceHeight}`, previewSpecs.find(([key]) => key === crop)?.[3] ?? crop.toUpperCase(), tileW, labelH), left, top: top + imageH });
  }
  await sharp({ create: { width: canvasW, height: canvasH, channels: 3, background: '#e8e8e5' } }).composite(composites).jpeg({ quality: 92, chromaSubsampling: '4:4:4' }).toFile(path.join(paths.sheets, filename));
}

async function main() {
  await Promise.all(Object.values(paths).map((directory) => mkdir(directory, { recursive: true })));
  const records = [];
  for (const item of candidates) {
    const sourcePath = path.join(paths.source, `${item.id}-${item.basename}-source.jpg`);
    const record = { id: item.id, group: item.group, sourceUrl: item.sourceUrl, provider: item.provider, photographer: item.photographer, location: item.location, sourceWidth: 0, sourceHeight: 0, sourceAspectRatio: 0, sourceFormat: '', sourceFileBytes: 0, downloadStatus: 'success', failureReason: null, previews: {} };
    try {
      const sourceMeta = await download(item, sourcePath);
      const sourceStat = await stat(sourcePath);
      Object.assign(record, { sourceWidth: sourceMeta.width, sourceHeight: sourceMeta.height, sourceAspectRatio: Number((sourceMeta.width / sourceMeta.height).toFixed(4)), sourceFormat: sourceMeta.format ?? '', sourceFileBytes: sourceStat.size });
      for (const [key, dir, spec] of previewSpecs) {
        const generated = output(dir, item);
        await makeDerivative(sourcePath, generated, spec);
        const generatedMeta = await sharp(generated).metadata();
        if (!generatedMeta.width || !generatedMeta.height || (generatedMeta.width > sourceMeta.width && generatedMeta.height > sourceMeta.height)) throw new Error(`Invalid ${key} derivative.`);
        record.previews[key] = path.relative(root, generated).replaceAll('\\', '/');
      }
      await copyFile(output(paths.native, item), path.join(paths.public, `${item.id}-${item.basename}-candidate.webp`));
    } catch (error) {
      record.downloadStatus = 'failed'; record.failureReason = error instanceof Error ? error.message : String(error);
      await rm(sourcePath, { force: true });
    }
    records.push(record);
  }
  const successful = records.filter((record) => record.downloadStatus === 'success');
  const byGroup = (group) => successful.filter((record) => record.group === group);
  const mapped = (recordsToMap) => recordsToMap.map((record) => ({ item: candidates.find((item) => item.id === record.id), sourceWidth: record.sourceWidth, sourceHeight: record.sourceHeight }));
  await contactSheet('01-world-native.jpg', mapped(byGroup('WORLD')), 'native');
  await contactSheet('02-world-wide.jpg', mapped(byGroup('WORLD')), 'wide');
  await contactSheet('03-world-portrait.jpg', mapped(byGroup('WORLD')), 'portrait');
  await contactSheet('04-discovery-native.jpg', mapped(byGroup('DISCOVERY')), 'native');
  await contactSheet('05-discovery-wide.jpg', mapped(byGroup('DISCOVERY')), 'wide');
  await contactSheet('06-merchant-native.jpg', mapped(byGroup('MERCHANT')), 'native');
  await contactSheet('07-merchant-wide.jpg', mapped(byGroup('MERCHANT')), 'wide');
  await contactSheet('08-product-material.jpg', mapped(byGroup('PRODUCT_MATERIAL')), 'square', 2);
  await contactSheet('09-handoff-native.jpg', mapped(byGroup('HANDOFF')), 'native');
  await contactSheet('10-handoff-wide.jpg', mapped(byGroup('HANDOFF')), 'wide');
  for (const [number, crop] of [['11', 'native'], ['12', 'wide'], ['13', 'portrait'], ['14', 'mobile'], ['15', 'square']]) await contactSheet(`${number}-all-${crop}.jpg`, mapped(successful), crop);
  const sequence = (ids) => mapped(ids.map((id) => successful.find((record) => record.id === id)).filter(Boolean));
  await contactSheet('16-story-sequence-a.jpg', sequence(['W01', 'D01', 'M01', 'P01', 'H01']), 'native', 5);
  await contactSheet('17-story-sequence-b.jpg', sequence(['D01', 'P01', 'M01', 'H01', 'W01']), 'native', 5);
  await contactSheet('18-story-sequence-c.jpg', sequence(['W01', 'M01', 'P01', 'D01', 'H01']), 'native', 5);
  await writeFile(path.join(paths.metadata, 'candidates.json'), `${JSON.stringify(records, null, 2)}\n`);
  console.log(JSON.stringify({ requested: candidates.length, successful: successful.length, failed: records.filter((record) => record.downloadStatus === 'failed').map((record) => ({ id: record.id, reason: record.failureReason })), derivatives: successful.length * 5 }, null, 2));
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
