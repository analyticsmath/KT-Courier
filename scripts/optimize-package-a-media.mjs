import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { optimize } from 'svgo';
import { execSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const downloadsDir = 'C:\\Users\\ANC\\Downloads';
const stagingDir = path.join(rootDir, '_asset-source', 'package-a');

const profiles = {
  hero: { maxLongSide: 2560, quality: 82, effort: 6 },
  large: { maxLongSide: 2200, quality: 82, effort: 6 },
  category: { maxLongSide: 1600, quality: 81, effort: 6 },
  auth: { maxLongSide: 1500, quality: 79, effort: 6 },
  alpha: { maxLongSide: 1600, quality: 82, alphaQuality: 100, effort: 6 },
};

// DO 1 & DO 3 Downloads-to-Staging map
const sourceDownloadsMap = [
  { downloadName: 'vije-vijendranath-PgSm_blvwLo-unsplash.jpg', rawName: 'raw-home-01-world-market.jpg' },
  { downloadName: 'vije-vijendranath-9o5zeS6QbgM-unsplash.jpg', rawName: 'raw-home-02-retail-local.jpg' },
  { downloadName: 'vije-vijendranath-UH0w8Uqr_3c-unsplash.jpg', rawName: 'raw-home-03-food-local.jpg' },
  { downloadName: 'fitnish-media-mQ2mZMcI1dc-unsplash.jpg', rawName: 'raw-home-04-grocery.jpg' },
  { downloadName: 'karolina-grabowska-AeRjba-rnZ4-unsplash.jpg', rawName: 'raw-home-05-fashion.jpg' },
  { downloadName: 'getty-images-J4O98B3J5UQ-unsplash.jpg', rawName: 'raw-home-06-wellness.jpg' },
  { downloadName: 'evelyn-verdin-5HzCyPiTY4w-unsplash.jpg', rawName: 'raw-home-07-homeware.jpg' },
  { downloadName: 'andrej-lisakov-2AhIG8gzxKk-unsplash.jpg', rawName: 'raw-home-08-merchant-prepare.jpg' },
  { downloadName: 'olivie-strauss-7lwzqaJ6AOc-unsplash.jpg', rawName: 'raw-home-09-package-detail.jpg' },
  { downloadName: 'getty-images-DRKIawamMok-unsplash.jpg', rawName: 'raw-home-10-handoff.jpg' },
  { downloadName: 'vije-vijendranath-HBUNTeUfLFo-unsplash.jpg', rawName: 'raw-home-11-route-city.jpg' },
  { downloadName: 'edgar-nunley-I5bJBT-TyGY-unsplash.jpg', rawName: 'raw-home-12-route-road.jpg' },
  { downloadName: 'getty-images-0jv3iso_ivc-unsplash.jpg', rawName: 'raw-home-13-arrival.jpg' },
  { downloadName: 'getty-images-6vNvCO9UieA-unsplash.jpg', rawName: 'raw-auth-01-customer.jpg' },
  { downloadName: 'getty-images-JrtZOTuic58-unsplash.jpg', rawName: 'raw-auth-02-merchant.jpg' },
  { downloadName: 'olivie-strauss-oo85_NuK5Zs-unsplash.jpg', rawName: 'raw-auth-03-product.jpg' },
  { downloadName: 'natalia-blauth-b8QrkJRDA9Q-unsplash.jpg', rawName: 'raw-auth-04-recovery.jpg' },
  { downloadName: 'toby-zar-jHWF5a5Zcf8-unsplash.svg', rawName: 'raw-ill-online-shopping.svg' },
  { downloadName: 'toby-zar-zDwyVhfR9Yg-unsplash.svg', rawName: 'raw-ill-package-receive.svg' },
  { downloadName: 'toby-zar-QzQGwueEuh0-unsplash.svg', rawName: 'raw-ill-security.svg' },
  { downloadName: 'Order Delivery.svg', rawName: 'raw-motion-order-state.svg' },
  { downloadName: 'gps location.svg', rawName: 'raw-motion-route-location.svg' },
  { downloadName: 'Package delivery.svg', rawName: 'raw-motion-arrival.svg' },
];

const rasterManifest = [
  { inputStem: 'raw-home-01-world-market', output: 'public/media/public/home/kt-home-01-world-market.webp', profile: 'hero' },
  { inputStem: 'raw-home-02-retail-local', output: 'public/media/public/home/kt-home-02-retail-local.webp', profile: 'category' },
  { inputStem: 'raw-home-03-food-local', output: 'public/media/public/home/kt-home-03-food-local.webp', profile: 'category' },
  { inputStem: 'raw-home-04-grocery', output: 'public/media/public/home/kt-home-04-grocery.webp', profile: 'category' },
  { inputStem: 'raw-home-05-fashion', output: 'public/media/public/home/kt-home-05-fashion.webp', profile: 'category' },
  { inputStem: 'cutout-home-05-fashion', output: 'public/media/public/home/kt-home-05-fashion-cutout.webp', profile: 'alpha' },
  { inputStem: 'raw-home-06-wellness', output: 'public/media/public/home/kt-home-06-wellness.webp', profile: 'category' },
  { inputStem: 'cutout-home-06-wellness', output: 'public/media/public/home/kt-home-06-wellness-cutout.webp', profile: 'alpha' },
  { inputStem: 'raw-home-07-homeware', output: 'public/media/public/home/kt-home-07-homeware.webp', profile: 'category' },
  { inputStem: 'raw-home-08-merchant-prepare', output: 'public/media/public/home/kt-home-08-merchant-prepare.webp', profile: 'large' },
  { inputStem: 'raw-home-09-package-detail', output: 'public/media/public/home/kt-home-09-package-detail.webp', profile: 'category' },
  { inputStem: 'raw-home-10-handoff', output: 'public/media/public/home/kt-home-10-handoff.webp', profile: 'large' },
  { inputStem: 'raw-home-11-route-city', output: 'public/media/public/home/kt-home-11-route-city.webp', profile: 'large' },
  { inputStem: 'raw-home-12-route-road', output: 'public/media/public/home/kt-home-12-route-road.webp', profile: 'large' },
  { inputStem: 'raw-home-13-arrival', output: 'public/media/public/home/kt-home-13-arrival.webp', profile: 'large' },
  { inputStem: 'raw-auth-01-customer', output: 'public/media/public/auth/kt-auth-01-customer.webp', profile: 'auth' },
  { inputStem: 'raw-auth-02-merchant', output: 'public/media/public/auth/kt-auth-02-merchant.webp', profile: 'auth' },
  { inputStem: 'raw-auth-03-product', output: 'public/media/public/auth/kt-auth-03-product.webp', profile: 'auth' },
  { inputStem: 'raw-auth-04-recovery', output: 'public/media/public/auth/kt-auth-04-recovery.webp', profile: 'auth' },
];

const illustrationManifest = [
  { input: 'raw-ill-online-shopping.svg', output: 'public/media/public/illustrations/kt-ill-online-shopping.svg' },
  { input: 'raw-ill-package-receive.svg', output: 'public/media/public/illustrations/kt-ill-package-receive.svg' },
  { input: 'raw-ill-security.svg', output: 'public/media/public/illustrations/kt-ill-security.svg', adjustSecurity: true },
];

const motionManifest = [
  { input: 'raw-motion-order-state.svg', output: 'public/media/public/motion/kt-motion-order-state.svg' },
  { input: 'raw-motion-route-location.svg', output: 'public/media/public/motion/kt-motion-route-location.svg' },
  { input: 'raw-motion-arrival.svg', output: 'public/media/public/motion/kt-motion-arrival.svg' },
];

function stageFiles() {
  console.log('=== Step 1: Staging Files from Downloads ===');
  fs.mkdirSync(stagingDir, { recursive: true });
  for (const item of sourceDownloadsMap) {
    const src = path.join(downloadsDir, item.downloadName);
    const dest = path.join(stagingDir, item.rawName);
    if (!fs.existsSync(src)) {
      console.warn(`Source not found in Downloads: ${item.downloadName}`);
      continue;
    }
    if (!fs.existsSync(dest)) {
      fs.copyFileSync(src, dest);
      console.log(`Staged: ${item.downloadName} -> _asset-source/package-a/${item.rawName}`);
    } else {
      console.log(`Already staged: ${item.rawName}`);
    }
  }
}

function generateCutouts() {
  console.log('\n=== Step 2: Generating Transparent Cutouts (H05 Fashion & H06 Wellness) ===');
  const cutouts = [
    { raw: 'raw-home-05-fashion.jpg', cutout: 'cutout-home-05-fashion.png' },
    { raw: 'raw-home-06-wellness.jpg', cutout: 'cutout-home-06-wellness.png' },
  ];
  for (const item of cutouts) {
    const rawPath = path.join(stagingDir, item.raw);
    const cutoutPath = path.join(stagingDir, item.cutout);
    if (!fs.existsSync(rawPath)) {
      console.warn(`Cannot generate cutout: ${item.raw} missing`);
      continue;
    }
    if (!fs.existsSync(cutoutPath)) {
      console.log(`Running rembg on ${item.raw} -> ${item.cutout}...`);
      try {
        const pyScript = `import rembg, PIL.Image; img = PIL.Image.open(r'''${rawPath}'''); out = rembg.remove(img); out.save(r'''${cutoutPath}''')`;
        execSync(`python -c "${pyScript}"`, { stdio: 'inherit' });
        console.log(`Generated cutout: ${item.cutout}`);
      } catch (err) {
        console.error(`Failed to generate cutout for ${item.raw}:`, err.message);
      }
    } else {
      console.log(`Cutout already exists: ${item.cutout}`);
    }
  }
}

async function optimizeMedia() {
  console.log('\n=== Step 3: Optimizing Rasters with Sharp ===');
  const results = [];
  for (const item of rasterManifest) {
    const possibleExts = ['.jpg', '.jpeg', '.png', '.webp', '.tif', '.tiff'];
    let inputPath = null;
    for (const ext of possibleExts) {
      const p = path.join(stagingDir, item.inputStem + ext);
      if (fs.existsSync(p)) {
        inputPath = p;
        break;
      }
    }

    if (!inputPath) {
      console.warn(`Input file missing for stem: ${item.inputStem}`);
      continue;
    }

    const outputPath = path.join(rootDir, item.output);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });

    const prof = profiles[item.profile];
    const inputStats = fs.statSync(inputPath);
    const image = sharp(inputPath);
    const meta = await image.metadata();

    let transform = sharp(inputPath).rotate();

    if (prof.maxLongSide) {
      const isWidthLonger = (meta.width || 0) >= (meta.height || 0);
      transform = transform.resize({
        width: isWidthLonger ? prof.maxLongSide : undefined,
        height: !isWidthLonger ? prof.maxLongSide : undefined,
        fit: 'inside',
        withoutEnlargement: true,
      });
    }

    if (item.profile === 'alpha') {
      transform = transform.webp({
        quality: prof.quality,
        alphaQuality: prof.alphaQuality || 100,
        effort: prof.effort,
        lossless: false,
      });
    } else {
      transform = transform.webp({
        quality: prof.quality,
        effort: prof.effort,
      });
    }

    await transform.toFile(outputPath);

    const outStats = fs.statSync(outputPath);
    const outMeta = await sharp(outputPath).metadata();
    const reduction = ((1 - outStats.size / inputStats.size) * 100).toFixed(1);

    results.push({
      stem: item.inputStem,
      inputDims: `${meta.width}x${meta.height}`,
      inputBytes: inputStats.size,
      outputDims: `${outMeta.width}x${outMeta.height}`,
      outputBytes: outStats.size,
      outputPath: item.output,
      reduction: `${reduction}%`,
      profile: item.profile,
    });
  }

  console.log('\n--- Raster Optimization Results ---');
  console.table(results.map(r => ({
    File: path.basename(r.outputPath),
    Profile: r.profile,
    'In Dims': r.inputDims,
    'In KB': (r.inputBytes / 1024).toFixed(1),
    'Out Dims': r.outputDims,
    'Out KB': (r.outputBytes / 1024).toFixed(1),
    Reduction: r.reduction,
  })));

  console.log('\n=== Step 4: Optimizing SVG Illustrations ===');
  for (const item of illustrationManifest) {
    const inputPath = path.join(stagingDir, item.input);
    const outputPath = path.join(rootDir, item.output);
    if (!fs.existsSync(inputPath)) {
      console.warn(`Illustration missing: ${item.input}`);
      continue;
    }
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });

    let svgData = fs.readFileSync(inputPath, 'utf8');
    if (item.adjustSecurity) {
      svgData = svgData.replace(/#6[cC]5[cC][eE]8/g, '#303532')
                       .replace(/#4[dD]3[bB]8[aA]/g, '#101210')
                       .replace(/#8[aA]7[cC][fF]8/g, '#DDE1E0')
                       .replace(/#e0e7ff/gi, '#F5F6F6')
                       .replace(/#6366f1/gi, '#D83A2E');
    }

    const optimized = optimize(svgData, {
      path: inputPath,
      multipass: true,
    });

    fs.writeFileSync(outputPath, optimized.data, 'utf8');
    const inSize = fs.statSync(inputPath).size;
    const outSize = fs.statSync(outputPath).size;
    console.log(`Optimized SVG: ${item.output} (${(inSize/1024).toFixed(1)} KB -> ${(outSize/1024).toFixed(1)} KB)`);
  }

  console.log('\n=== Step 5: Copying & Preserving Motion Animated SVGs ===');
  for (const item of motionManifest) {
    const inputPath = path.join(stagingDir, item.input);
    const outputPath = path.join(rootDir, item.output);
    if (!fs.existsSync(inputPath)) {
      console.warn(`Motion SVG missing: ${item.input}`);
      continue;
    }
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });

    const svgContent = fs.readFileSync(inputPath, 'utf8');
    fs.writeFileSync(outputPath, svgContent, 'utf8');
    const size = fs.statSync(outputPath).size;
    console.log(`Motion Animated SVG Ready: ${item.output} (${(size/1024).toFixed(1)} KB)`);
  }
}

function verifyAndClean() {
  const isClean = process.argv.includes('--clean');
  console.log(`\n=== Step 6: Verification & Cleanup (isClean: ${isClean}) ===`);

  const allOutputs = [
    ...rasterManifest.map(m => m.output),
    ...illustrationManifest.map(m => m.output),
    ...motionManifest.map(m => m.output),
  ];

  let missing = 0;
  for (const out of allOutputs) {
    const fullPath = path.join(rootDir, out);
    if (!fs.existsSync(fullPath)) {
      console.error(`MISSING OUTPUT: ${out}`);
      missing++;
    }
  }

  if (missing > 0) {
    console.error(`Verification FAILED: ${missing} outputs missing. Skipping cleanup.`);
    return;
  }

  console.log(`All ${allOutputs.length} production outputs successfully verified!`);

  if (isClean) {
    console.log('Cleaning raw files in _asset-source/package-a/ ...');
    if (fs.existsSync(stagingDir)) {
      const files = fs.readdirSync(stagingDir);
      for (const file of files) {
        fs.unlinkSync(path.join(stagingDir, file));
      }
      fs.rmdirSync(stagingDir);
      console.log('Staging folder _asset-source/package-a/ cleanly removed.');
    }
  }
}

async function main() {
  stageFiles();
  generateCutouts();
  await optimizeMedia();
  verifyAndClean();
}

main().catch(err => {
  console.error('Fatal error in media pipeline:', err);
  process.exit(1);
});
