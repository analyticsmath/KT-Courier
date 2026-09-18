import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import https from "node:https";
import sharp from "sharp";

const ROOT_DIR = process.cwd();
const TARGET_DIR = path.join(ROOT_DIR, "public", "media", "public", "editorial-2026");

const ASSETS = [
  {
    code: "A01",
    filename: "jhb-rosebank-market-people.webp",
    topic: "Rosebank Sunday market people",
    photographer: "Vije Vijendranath",
    assetId: "PgSm_blvwLo",
    url: "https://images.unsplash.com/photo-1692689383052-9fbf3d1c0969?crop=entropy&cs=srgb&fm=jpg&ixid=M3wxMDE2NzMxfDB8MXxzZWFyY2h8MXx8Sm9oYW5uZXNidXJnJTIwbWFya2V0fGVufDF8MHw0fHwxNzg5NTczMzMyfDA&ixlib=rb-4.1.0&q=85",
  },
  {
    code: "A02",
    filename: "jhb-rosebank-market-craft.webp",
    topic: "Artisan figurines and craft",
    photographer: "Vije Vijendranath",
    assetId: "V0pEMz63Om8",
    url: "https://images.unsplash.com/photo-1692689382577-a5c381f71438?crop=entropy&cs=srgb&fm=jpg&ixid=M3wxMDE2NzMxfDB8MXxzZWFyY2h8Mnx8Sm9oYW5uZXNidXJnJTIwbWFya2V0fGVufDF8MHw0fHwxNzg5NTczMzMyfDA&ixlib=rb-4.1.0&q=85",
  },
  {
    code: "A03",
    filename: "jhb-rosebank-jewelry.webp",
    topic: "Handcrafted jewelry",
    photographer: "Vije Vijendranath",
    assetId: "ooxENekCvrM",
    url: "https://images.unsplash.com/photo-1692689381207-d42607ccd2c1?crop=entropy&cs=srgb&fm=jpg&ixid=M3wxMDE2NzMxfDB8MXxzZWFyY2h8M3x8Sm9oYW5uZXNidXJnJTIwbWFya2V0fGVufDF8MHw0fHwxNzg5NTczMzMyfDA&ixlib=rb-4.1.0&q=85",
  },
  {
    code: "A04",
    filename: "jhb-rosebank-plants.webp",
    topic: "Potted plants & home craft",
    photographer: "Vije Vijendranath",
    assetId: "6tzVFGSeFpk",
    url: "https://images.unsplash.com/photo-1692689385412-d811312a63a3?crop=entropy&cs=srgb&fm=jpg&ixid=M3wxMDE2NzMxfDB8MXxzZWFyY2h8NXx8Sm9oYW5uZXNidXJnJTIwbWFya2V0fGVufDF8MHw0fHwxNzg5NTczMzMyfDA&ixlib=rb-4.1.0&q=85",
  },
  {
    code: "A05",
    filename: "jhb-rosebank-bags.webp",
    topic: "Handcrafted market bags",
    photographer: "Vije Vijendranath",
    assetId: "9o5zeS6QbgM",
    url: "https://images.unsplash.com/photo-1692689383138-c2df3476072c?crop=entropy&cs=srgb&fm=jpg&ixid=M3wxMDE2NzMxfDB8MXxzZWFyY2h8Nnx8Sm9oYW5uZXNidXJnJTIwbWFya2V0fGVufDF8MHw0fHwxNzg5NTczMzMyfDA&ixlib=rb-4.1.0&q=85",
  },
  {
    code: "A06",
    filename: "jhb-rosebank-market-interaction.webp",
    topic: "Maker market interaction",
    photographer: "Vije Vijendranath",
    assetId: "lcPbyRE-xzY",
    url: "https://images.unsplash.com/photo-1692689386358-910e46764d20?crop=entropy&cs=srgb&fm=jpg&ixid=M3wxMDE2NzMxfDB8MXxzZWFyY2h8N3x8Sm9oYW5uZXNidXJnJTIwbWFya2V0fGVufDF8MHw0fHwxNzg5NTczMzMyfDA&ixlib=rb-4.1.0&q=85",
  },
  {
    code: "B01",
    filename: "jhb-fashion-brown-coat.webp",
    topic: "Street fashion portrait",
    photographer: "Adelade Mbuyazi",
    assetId: "8le0aECDnvE",
    url: "https://images.unsplash.com/photo-1630527422491-12f4b1b8c019?crop=entropy&cs=srgb&fm=jpg&ixid=M3wxMDE2NzMxfDB8MXxzZWFyY2h8MXx8Sm9oYW5uZXNidXJnJTIwc3RyZWV0JTIwZmFzaGlvbnxlbnwxfDF8NHx8MTc4OTU3MzMzN3ww&ixlib=rb-4.1.0&q=85",
  },
  {
    code: "B02",
    filename: "jhb-fashion-graffiti.webp",
    topic: "Streetwear near graffiti",
    photographer: "Ayanda Kunene",
    assetId: "FAbVtEeWiJQ",
    url: "https://images.unsplash.com/photo-1760509371031-6bf1372b77ad?crop=entropy&cs=srgb&fm=jpg&ixid=M3wxMDE2NzMxfDB8MXxzZWFyY2h8Mnx8Sm9oYW5uZXNidXJnJTIwc3RyZWV0JTIwZmFzaGlvbnxlbnwxfDF8NHx8MTc4OTU3MzMzN3ww&ixlib=rb-4.1.0&q=85",
  },
  {
    code: "B03",
    filename: "jhb-fashion-white-top.webp",
    topic: "Urban portrait crop",
    photographer: "Ayanda Kunene",
    assetId: "MbPsnFPnnRU",
    url: "https://images.unsplash.com/photo-1760509370911-b134eaa23d5a?crop=entropy&cs=srgb&fm=jpg&ixid=M3wxMDE2NzMxfDB8MXxzZWFyY2h8M3x8Sm9oYW5uZXNidXJnJTIwc3RyZWV0JTIwZmFzaGlvbnxlbnwxfDF8NHx8MTc4OTU3MzMzN3ww&ixlib=rb-4.1.0&q=85",
  },
  {
    code: "C01",
    filename: "sa-market-fruit-crates.webp",
    topic: "Fresh market fruit crates",
    photographer: "R. du Plessis",
    assetId: "cXvqCw0m5WE",
    url: "https://images.unsplash.com/photo-1630960411440-10f7b59717ba?crop=entropy&cs=srgb&fm=jpg&ixid=M3wxMDE2NzMxfDB8MXxzZWFyY2h8MXx8U291dGglMjBBZnJpY2ElMjBmb29kJTIwbWFya2V0fGVufDF8MHw0fHwxNzg5NTczMzU1fDA&ixlib=rb-4.1.0&q=85",
  },
  {
    code: "C02",
    filename: "cape-town-market-vegetables.webp",
    topic: "Cape Town market produce",
    photographer: "FitNish Media",
    assetId: "mQ2mZMcI1dc",
    url: "https://images.unsplash.com/photo-1599997842102-744084270ad2?crop=entropy&cs=srgb&fm=jpg&ixid=M3wxMDE2NzMxfDB8MXxzZWFyY2h8Mnx8U291dGglMjBBZnJpY2ElMjBmb29kJTIwbWFya2V0fGVufDF8MHw0fHwxNzg5NTczMzU1fDA&ixlib=rb-4.1.0&q=85",
  },
  {
    code: "C03",
    filename: "cape-town-market-ceramics.webp",
    topic: "Artisan market ceramics",
    photographer: "FitNish Media",
    assetId: "C77n2yK8brk",
    url: "https://images.unsplash.com/photo-1599998012871-f8af4178344c?crop=entropy&cs=srgb&fm=jpg&ixid=M3wxMDE2NzMxfDB8MXxzZWFyY2h8NHx8U291dGglMjBBZnJpY2ElMjBmb29kJTIwbWFya2V0fGVufDF8MHw0fHwxNzg5NTczMzU1fDA&ixlib=rb-4.1.0&q=85",
  },
  {
    code: "C04",
    filename: "cape-town-market-food-bowl.webp",
    topic: "Local market food bowl",
    photographer: "FitNish Media",
    assetId: "y0njljTYxHA",
    url: "https://images.unsplash.com/photo-1599997664183-d12db5e764d8?crop=entropy&cs=srgb&fm=jpg&ixid=M3wxMDE2NzMxfDB8MXxzZWFyY2h8Nnx8U291dGglMjBBZnJpY2ElMjBmb29kJTIwbWFya2V0fGVufDF8MHw0fHwxNzg5NTczMzU1fDA&ixlib=rb-4.1.0&q=85",
  },
  {
    code: "D01",
    filename: "jhb-urban-aerial.webp",
    topic: "Johannesburg urban skyline",
    photographer: "Pieter van Noorden",
    assetId: "SIpx7mJV6tI",
    url: "https://images.unsplash.com/photo-1621336831096-0ef225705c56?crop=entropy&cs=srgb&fm=jpg&ixid=M3wxMDE2NzMxfDB8MXxzZWFyY2h8NXx8U291dGglMjBBZnJpY2ElMjBjb3VyaWVyfGVufDF8MHw0fHwxNzg5NTczMzQxfDA&ixlib=rb-4.1.0&q=85",
  },
  {
    code: "D02",
    filename: "cape-town-road-night.webp",
    topic: "Night road transit corridor",
    photographer: "Thomas Bennie",
    assetId: "_JzcBzJV0E8",
    url: "https://images.unsplash.com/photo-1592489879592-0205beb1e766?crop=entropy&cs=srgb&fm=jpg&ixid=M3wxMDE2NzMxfDB8MXxzZWFyY2h8OHx8U291dGglMjBBZnJpY2ElMjBjb3VyaWVyfGVufDF8MHw0fHwxNzg5NTczMzQxfDA&ixlib=rb-4.1.0&q=85",
  },
  {
    code: "D03",
    filename: "jhb-maboneng-vehicle-workshop.webp",
    topic: "Urban fleet / maker garage",
    photographer: "Marc St",
    assetId: "LCtDPn_2aTE",
    url: "https://images.unsplash.com/photo-1526583038916-f138f908476b?crop=entropy&cs=srgb&fm=jpg&ixid=M3wxMDE2NzMxfDB8MXxzZWFyY2h8NXx8U291dGglMjBBZnJpY2ElMjBhcnRpc2FuJTIwd29ya3Nob3B8ZW58MXwwfDR8fDE3ODk1NzMzNDd8MA&ixlib=rb-4.1.0&q=85",
  },
];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function fetchBuffer(url, redirects = 5, retries = 3) {
  return new Promise((resolve, reject) => {
    if (redirects < 0) return reject(new Error("Too many redirects"));

    const attempt = (remainingRetries) => {
      const req = https.get(
        url,
        { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" }, timeout: 25000 },
        (res) => {
          if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            return resolve(fetchBuffer(res.headers.location, redirects - 1, retries));
          }
          if (res.statusCode !== 200) {
            if (remainingRetries > 0) {
              console.log(`    HTTP ${res.statusCode}, retrying (${remainingRetries} attempts left)...`);
              return setTimeout(() => attempt(remainingRetries - 1), 2500);
            }
            return reject(new Error(`HTTP ${res.statusCode} from ${url}`));
          }
          const chunks = [];
          res.on("data", (c) => chunks.push(c));
          res.on("end", () => resolve(Buffer.concat(chunks)));
          res.on("error", (err) => {
            if (remainingRetries > 0) {
              console.log(`    Socket error: ${err.message}, retrying...`);
              return setTimeout(() => attempt(remainingRetries - 1), 2500);
            }
            reject(err);
          });
        }
      );

      req.on("timeout", () => {
        req.destroy();
        if (remainingRetries > 0) {
          console.log(`    Timeout, retrying...`);
          return setTimeout(() => attempt(remainingRetries - 1), 2500);
        }
        reject(new Error(`Timeout fetching ${url}`));
      });

      req.on("error", (err) => {
        if (remainingRetries > 0) {
          console.log(`    Request error: ${err.message}, retrying...`);
          return setTimeout(() => attempt(remainingRetries - 1), 2500);
        }
        reject(err);
      });
    };

    attempt(retries);
  });
}

async function main() {
  console.log("=== Acquiring 16 Supplemental Editorial Assets ===");
  fs.mkdirSync(TARGET_DIR, { recursive: true });

  const provenanceRecords = [];

  for (const asset of ASSETS) {
    const targetFile = path.join(TARGET_DIR, asset.filename);
    console.log(`\n[${asset.code}] Checking ${asset.filename} (${asset.photographer})...`);

    let processedBuffer;
    if (fs.existsSync(targetFile) && fs.statSync(targetFile).size > 10000) {
      console.log(`  Already exists locally (${(fs.statSync(targetFile).size / 1024).toFixed(1)} KB). Skipping download.`);
      processedBuffer = fs.readFileSync(targetFile);
    } else {
      let rawBuffer;
      try {
        await sleep(1200);
        rawBuffer = await fetchBuffer(asset.url);
        console.log(`  Downloaded: ${(rawBuffer.length / 1024).toFixed(1)} KB`);
      } catch (err) {
        console.error(`  Failed to download ${asset.url}:`, err.message);
        continue;
      }

      // Process with Sharp
      processedBuffer = await sharp(rawBuffer)
        .rotate()
        .resize({
          width: 2560,
          height: 2560,
          fit: "inside",
          withoutEnlargement: true,
        })
        .webp({ quality: 84 })
        .toBuffer();

      fs.writeFileSync(targetFile, processedBuffer);
    }

    const outMeta = await sharp(processedBuffer).metadata();
    const sha256 = crypto.createHash("sha256").update(processedBuffer).digest("hex");

    console.log(`  Ready: ${outMeta.width}x${outMeta.height} (${(processedBuffer.length / 1024).toFixed(1)} KB) SHA256: ${sha256.substring(0, 12)}...`);

    const record = {
      code: asset.code,
      filename: asset.filename,
      publicUrl: `/media/public/editorial-2026/${asset.filename}`,
      filePath: `public/media/public/editorial-2026/${asset.filename}`,
      width: outMeta.width,
      height: outMeta.height,
      sha256,
      checksum: sha256,
      dimensions: `${outMeta.width}x${outMeta.height}`,
      photographer: asset.photographer,
      topic: asset.topic,
      unsplashAssetId: asset.assetId,
      sourceUrl: `https://unsplash.com/photos/${asset.assetId}`,
      directUrl: asset.url,
      license: "Unsplash Commercial License",
      retrievedAt: new Date().toISOString(),
    };

    provenanceRecords.push(record);
  }

  // Update docs/media-provenance-manifest.json
  const manifestPath = path.join(ROOT_DIR, "docs", "media-provenance-manifest.json");
  if (fs.existsSync(manifestPath)) {
    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
      if (Array.isArray(manifest.manifest)) {
        let addedCount = 0;
        for (const rec of provenanceRecords) {
          const already = manifest.manifest.some((m) => m.entityId === rec.code || m.filePath === rec.filePath);
          if (!already) {
            manifest.manifest.push({
              entityType: "EDITORIAL_ASSET",
              entityId: rec.code,
              entityName: rec.topic,
              assetId: `cma-editorial-2026-${rec.code.toLowerCase()}`,
              filePath: rec.filePath,
              publicUrl: rec.publicUrl,
              checksum: rec.sha256,
              dimensions: rec.dimensions,
              licence: rec.license,
              creator: rec.photographer,
              retrievalDate: rec.retrievedAt,
            });
            addedCount++;
          }
        }
        manifest.totalAssets = manifest.manifest.length;
        fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf8");
        console.log(`\nUpdated ${manifestPath} (+${addedCount} new records, total: ${manifest.totalAssets})`);
      }
    } catch (e) {
      console.warn("Could not update media-provenance-manifest.json:", e.message);
    }
  }

  // Update docs/demo-data/image-provenance.json
  const demoProvPath = path.join(ROOT_DIR, "docs", "demo-data", "image-provenance.json");
  if (fs.existsSync(demoProvPath)) {
    try {
      const demoProv = JSON.parse(fs.readFileSync(demoProvPath, "utf8"));
      if (Array.isArray(demoProv)) {
        let addedCount = 0;
        for (const rec of provenanceRecords) {
          const already = demoProv.some((d) => d.publicReference === `CMA-EDITORIAL-2026-${rec.code}` || d.relativePath === `editorial-2026/${rec.filename}`);
          if (!already) {
            demoProv.push({
              publicReference: `CMA-EDITORIAL-2026-${rec.code}`,
              storageKey: `editorial-2026/${rec.sha256}`,
              relativePath: `editorial-2026/${rec.filename}`,
              width: rec.width,
              height: rec.height,
              mimeType: "image/webp",
              byteSize: fs.statSync(path.join(TARGET_DIR, rec.filename)).size,
              checksum: rec.sha256,
              sha256: rec.sha256,
              purpose: "EDITORIAL_MONOGRAPH",
              alt: `${rec.topic} photographed by ${rec.photographer}`,
              license: rec.license,
              author: rec.photographer,
              source: "Unsplash",
              sourceUrl: rec.sourceUrl,
              provider: "unsplash",
              pageUrl: rec.sourceUrl,
              assetUrl: rec.directUrl,
              retrievedAt: rec.retrievedAt,
              subject: rec.topic,
            });
            addedCount++;
          }
        }
        fs.writeFileSync(demoProvPath, JSON.stringify(demoProv, null, 2), "utf8");
        console.log(`Updated ${demoProvPath} (+${addedCount} new records, total: ${demoProv.length})`);
      }
    } catch (e) {
      console.warn("Could not update image-provenance.json:", e.message);
    }
  }

  console.log("\n=== Media Acquisition Complete ===");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
