import { readdir, stat, mkdir, writeFile, copyFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const rootDir = process.cwd();
const sourceImagesDir = path.join(rootDir, "public", "media", "public", "images");
const artifactsMediaDir = path.join(rootDir, "artifacts", "media");
const contactSheetsDir = path.join(artifactsMediaDir, "contact-sheets");
const thumbnailsDir = path.join(contactSheetsDir, "thumbnails");
const ledgerPath = path.join(artifactsMediaDir, "visual-selection-ledger.json");

// Define the 11 categories
const CATEGORIES = [
  { id: "editorial-commerce", num: "01", title: "Editorial & Local Commerce", dir: "editorial-commerce" },
  { id: "courier-human", num: "02", title: "Courier & Human Logistics", dir: "courier-human" },
  { id: "merchant-preparation", num: "03", title: "Merchant Preparation & Packing", dir: "merchant-preparation" },
  { id: "food-grocery", num: "04", title: "Food, Grocery & Fresh Produce", dir: "food-grocery" },
  { id: "fashion-retail", num: "05", title: "Fashion, Apparel & Retail", dir: "fashion-retail" },
  { id: "wellness-pharmacy", num: "06", title: "Wellness, Health & Apothecary", dir: "wellness-pharmacy" },
  { id: "route-road-aerial", num: "07", title: "Route, Highway & Aerial Geography", dir: "route-road-aerial" },
  { id: "warehouse-freight", num: "08", title: "Warehouse, Freight & Industrial Capacity", dir: "warehouse-freight" },
  { id: "community-market", num: "09", title: "Community Markets & Urban Life", dir: "community-market" },
  { id: "protagonist-packs", num: "10", title: "Protagonist Asset Packs (Vehicles & Courier)", dir: "protagonist-packs" },
  { id: "illustrations", num: "11", title: "Vector Operational Illustrations", dir: "illustrations" },
];

// Mapping helper for the 191 assets
function categorizeAsset(relPath, filename) {
  if (relPath.startsWith("white_truck_asset_pack_16_images/") ||
      relPath.startsWith("KT_Courier_Van_Asset_Pack_14_PNGs/") ||
      relPath.startsWith("truck_asset_pack_12_images/") ||
      relPath.startsWith("KT_Courier_20_Transparent_PNG_Assets/")) {
    return "protagonist-packs";
  }
  if (relPath.startsWith("illustration/")) {
    return "illustrations";
  }

  const f = filename.toLowerCase();

  // Category 4: Food & Grocery
  if (f.includes("market-fruit") || f.includes("market-vegetables") || f.includes("food-bowl") ||
      f.includes("pelzer") || f.includes("allison-saeng") || f.includes("nick-karvounis") ||
      f.includes("roberto-sorin") || f.includes("3hrjvdmsd8y") || f.includes("6uspkkg3fvk") ||
      f.includes("bby6amj8b_i")) {
    return "food-grocery";
  }

  // Category 5: Fashion & Retail
  if (f.includes("jhb-fashion") || f.includes("rosebank-bags") || f.includes("rosebank-jewelry") ||
      f.includes("adly-hakim") || f.includes("bayu-syaits") || f.includes("j4o98b3j5uq") ||
      f.includes("jrtzotuic58") || f.includes("k1ecjqo9yes") || f.includes("lb-1kfuzt6g")) {
    return "fashion-retail";
  }

  // Category 6: Wellness & Pharmacy
  if (f.includes("karolina-grabowska") || f.includes("ela-de-pure") || f.includes("declan-sun") ||
      f.includes("drkiawammok") || f.includes("ov2h8nh6cog") || f.includes("sa0cuvlc2kg")) {
    return "wellness-pharmacy";
  }

  // Category 7: Route & Road & Aerial
  if (f.includes("vije-vijendranath") || f.includes("mavic") || f.includes("chuttersnap") ||
      f.includes("road-night") || f.includes("urban-aerial") || f.includes("casey-horner") ||
      f.includes("ey449nzwjco") || f.includes("fnfsncrrujc") || f.includes("aedrian-salazar") ||
      f.includes("h4no8yor_wq") || f.includes("t5itfwrljm0")) {
    return "route-road-aerial";
  }

  // Category 8: Warehouse & Freight
  if (f.includes("renato-leal") || f.includes("jonathan-castaneda") || f.includes("martijn-baudoin") ||
      f.includes("yunus-tug") || f.includes("0jv3iso_ivc") || f.includes("14wslu0sib0") ||
      f.includes("6_czswwhzak") || f.includes("a_y9biqs7zy") || f.includes("cn2yh0gjllg") ||
      f.includes("fhww8w67teo") || f.includes("loumwkoanhy") || f.includes("bmpkidmmmo4")) {
    return "warehouse-freight";
  }

  // Category 2: Courier & Human Logistics
  if (f.includes("r2-doc-") || f.includes("kt-auth-01") || f.includes("fitnish-media") ||
      f.includes("alex-reynolds") || f.includes("aleksandrs-karevs") || f.includes("olivier-drouin") ||
      f.includes("beauty-van-stam") || f.includes("graddes-8puq") || f.includes("pwvw9nhkqdm") ||
      f.includes("y7l4062c4ac")) {
    return "courier-human";
  }

  // Category 3: Merchant Preparation & Packing
  if (f.includes("kt-auth-02") || f.includes("r2-net-01") || f.includes("andrej-lisakov") ||
      f.includes("andy-quezada") || f.includes("ramses-cervantes") || f.includes("maboneng-vehicle-workshop") ||
      f.includes("evelyn-verdin") || f.includes("polina-kuzovkova") || f.includes("bytyfnf6rwu") ||
      f.includes("mje_n3x3lnc")) {
    return "merchant-preparation";
  }

  // Category 9: Community Markets & Urban Life
  if (f.includes("rosebank-market") || f.includes("rosebank-plants") || f.includes("unsplash-community") ||
      f.includes("olivie-strauss") || f.includes("fellipe-ditadi") || f.includes("zero-oukibt") ||
      f.includes("ubaid-e-alyafizi") || f.includes("mz1umzw1py8") || f.includes("lpg6f9aaoja")) {
    return "community-market";
  }

  // Category 1: Editorial & Commerce (Default for remaining lifestyle / craft / ceramics / homeware)
  return "editorial-commerce";
}

async function scanFiles(dir, baseDir) {
  let entries = [];
  const items = await readdir(dir, { withFileTypes: true });
  for (const item of items) {
    const fullPath = path.join(dir, item.name);
    if (item.isDirectory()) {
      entries = entries.concat(await scanFiles(fullPath, baseDir));
    } else if (/\.(png|jpe?g|webp|svg)$/i.test(item.name)) {
      entries.push({
        fullPath,
        relPath: path.relative(baseDir, fullPath).split(path.sep).join("/"),
        filename: item.name,
      });
    }
  }
  return entries;
}

async function main() {
  console.log("=== STEP 1: SOURCE MEDIA CONTACT SHEETS & SELECTION LEDGER ===");
  await mkdir(contactSheetsDir, { recursive: true });
  await mkdir(thumbnailsDir, { recursive: true });

  const rawFiles = await scanFiles(sourceImagesDir, sourceImagesDir);
  console.log(`Auditing ${rawFiles.length} raw assets in master library...`);

  const categoryBuckets = new Map(CATEGORIES.map(c => [c.id, []]));
  const auditedAssets = [];

  for (let i = 0; i < rawFiles.length; i++) {
    const file = rawFiles[i];
    const isSvg = file.filename.endsWith(".svg");
    const s = await stat(file.fullPath);
    let meta = { width: 800, height: 800, format: "svg", hasAlpha: true };

    if (!isSvg) {
      meta = await sharp(file.fullPath).metadata();
    }

    const width = meta.width || 800;
    const height = meta.height || 800;
    const aspectRatio = Number((width / height).toFixed(3));
    const orientation = aspectRatio > 1.15 ? "landscape" : aspectRatio < 0.85 ? "portrait" : "square";
    const categoryId = categorizeAsset(file.relPath, file.filename);

    // Generate thumbnail
    const thumbName = file.relPath.replace(/\//g, "--").replace(/\.[^.]+$/, "") + ".webp";
    const thumbPath = path.join(thumbnailsDir, thumbName);
    const thumbRelPath = `thumbnails/${thumbName}`;

    try {
      if (isSvg) {
        // Render SVG to 320px WebP
        await sharp(file.fullPath).resize({ width: 320 }).webp().toFile(thumbPath);
      } else {
        await sharp(file.fullPath)
          .rotate()
          .resize({ width: 320, height: 240, fit: "inside", withoutEnlargement: true })
          .webp({ quality: 80 })
          .toFile(thumbPath);
      }
    } catch (err) {
      console.warn(`[WARN] Failed to thumb ${file.relPath}: ${err.message}`);
    }

    const assetRecord = {
      relPath: file.relPath,
      filename: file.filename,
      categoryId,
      width,
      height,
      aspectRatio,
      orientation,
      bytes: s.size,
      sizeFormatted: (s.size / (1024 * 1024)).toFixed(2) + " MB",
      format: meta.format || (isSvg ? "svg" : "unknown"),
      hasAlpha: Boolean(meta.hasAlpha),
      thumbPath: thumbRelPath,
    };

    auditedAssets.push(assetRecord);
    categoryBuckets.get(categoryId).push(assetRecord);
  }

  // Write HTML contact sheets
  for (const cat of CATEGORIES) {
    const assets = categoryBuckets.get(cat.id) || [];
    const html = generateCategoryHtml(cat, assets, CATEGORIES);
    const sheetPath = path.join(contactSheetsDir, `${cat.num}-${cat.id}.html`);
    await writeFile(sheetPath, html, "utf8");
    console.log(`Generated contact sheet: ${cat.num}-${cat.id}.html (${assets.length} assets)`);
  }

  // Write index.html
  const indexHtml = generateIndexHtml(CATEGORIES, categoryBuckets, auditedAssets.length);
  await writeFile(path.join(contactSheetsDir, "index.html"), indexHtml, "utf8");
  console.log(`Generated contact sheets index: index.html`);

  // Build the Visual Selection Ledger (60–75 runtime photographic candidates)
  const ledger = generateSelectionLedger(auditedAssets);
  await writeFile(ledgerPath, JSON.stringify(ledger, null, 2), "utf8");
  console.log(`Generated visual selection ledger: ${ledgerPath} (${ledger.length} candidates)`);
}

function generateIndexHtml(categories, buckets, totalCount) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>KT Courier — Source Media Contact Sheets</title>
  <style>
    :root {
      --bg: #F1ECE2;
      --card: #FBF9F3;
      --dark: #0B0D0F;
      --concrete: #CDC4B5;
      --graphite: #5D5A55;
      --accent: #3479F8;
    }
    body {
      margin: 0;
      padding: 40px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: var(--bg);
      color: var(--dark);
    }
    header {
      max-width: 1200px;
      margin: 0 auto 40px;
      border-bottom: 2px solid var(--dark);
      padding-bottom: 24px;
    }
    h1 {
      font-size: 32px;
      margin: 0 0 8px;
      letter-spacing: -0.02em;
    }
    p {
      color: var(--graphite);
      margin: 0;
      font-size: 16px;
    }
    .grid {
      max-width: 1200px;
      margin: 0 auto;
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
      gap: 20px;
    }
    .card {
      background: var(--card);
      border: 1px solid var(--concrete);
      padding: 24px;
      border-radius: 4px;
      text-decoration: none;
      color: inherit;
      transition: border-color 0.2s, transform 0.2s;
    }
    .card:hover {
      border-color: var(--dark);
      transform: translateY(-2px);
    }
    .card-num {
      font-family: monospace;
      font-size: 12px;
      color: var(--graphite);
      margin-bottom: 8px;
    }
    .card-title {
      font-size: 18px;
      font-weight: 600;
      margin-bottom: 12px;
    }
    .card-meta {
      font-size: 14px;
      color: var(--graphite);
    }
  </style>
</head>
<body>
  <header>
    <h1>KT COURIER — SOURCE MEDIA CONTACT SHEETS</h1>
    <p>191 Master Assets Across 11 Visual Categories &bull; Local Asset Audit &bull; Total Files: ${totalCount}</p>
  </header>
  <div class="grid">
    ${categories.map(c => {
      const count = (buckets.get(c.id) || []).length;
      return `
      <a class="card" href="${c.num}-${c.id}.html">
        <div class="card-num">${c.num} / 11</div>
        <div class="card-title">${c.title}</div>
        <div class="card-meta">${count} assets cataloged</div>
      </a>
      `;
    }).join("")}
  </div>
</body>
</html>`;
}

function generateCategoryHtml(cat, assets, allCategories) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>KT Courier — ${cat.title}</title>
  <style>
    :root {
      --bg: #F1ECE2;
      --card: #FBF9F3;
      --dark: #0B0D0F;
      --concrete: #CDC4B5;
      --graphite: #5D5A55;
      --accent: #3479F8;
    }
    body {
      margin: 0;
      padding: 32px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: var(--bg);
      color: var(--dark);
    }
    header {
      max-width: 1400px;
      margin: 0 auto 32px;
      border-bottom: 2px solid var(--dark);
      padding-bottom: 16px;
    }
    .nav {
      font-size: 13px;
      margin-bottom: 12px;
    }
    .nav a {
      color: var(--accent);
      text-decoration: none;
      margin-right: 12px;
    }
    h1 {
      font-size: 26px;
      margin: 0 0 6px;
    }
    .subtitle {
      color: var(--graphite);
      font-size: 14px;
    }
    .grid {
      max-width: 1400px;
      margin: 0 auto;
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 20px;
    }
    .asset-card {
      background: var(--card);
      border: 1px solid var(--concrete);
      border-radius: 4px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }
    .img-wrap {
      width: 100%;
      height: 200px;
      background: #E5E0D5;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
    }
    .img-wrap img {
      max-width: 100%;
      max-height: 100%;
      object-fit: contain;
    }
    .meta {
      padding: 12px 14px;
      font-size: 12px;
      line-height: 1.4;
      flex: 1;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }
    .filename {
      font-weight: 600;
      word-break: break-all;
      margin-bottom: 6px;
      font-size: 13px;
    }
    .details {
      color: var(--graphite);
      font-family: monospace;
      font-size: 11px;
    }
    .tag {
      display: inline-block;
      margin-top: 8px;
      padding: 2px 6px;
      background: var(--bg);
      border: 1px solid var(--concrete);
      border-radius: 2px;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
  </style>
</head>
<body>
  <header>
    <div class="nav">
      <a href="index.html">&larr; Back to Master Index</a>
      ${allCategories.map(c => `<a href="${c.num}-${c.id}.html">${c.num}</a>`).join(" ")}
    </div>
    <h1>${cat.num}. ${cat.title}</h1>
    <div class="subtitle">${assets.length} assets &bull; Master Design Library</div>
  </header>
  <div class="grid">
    ${assets.map(a => `
      <div class="asset-card">
        <div class="img-wrap">
          <img src="${a.thumbPath}" alt="${a.filename}" loading="lazy" />
        </div>
        <div class="meta">
          <div class="filename">${a.filename}</div>
          <div class="details">
            ${a.width}&times;${a.height} &bull; ${a.aspectRatio}:1 (${a.orientation})<br>
            ${a.sizeFormatted} &bull; ${a.format.toUpperCase()}
          </div>
          <div><span class="tag">${a.orientation}</span></div>
        </div>
      </div>
    `).join("")}
  </div>
</body>
</html>`;
}

function generateSelectionLedger(auditedAssets) {
  // Select candidate photographs (excluding vector and protagonist cutout PNGs)
  const photos = auditedAssets.filter(a => a.categoryId !== "protagonist-packs" && a.categoryId !== "illustrations");

  // Selection list with curated metadata
  const selections = [];

  for (const p of photos) {
    const f = p.filename.toLowerCase();
    let semanticId = "";
    let subject = "";
    let visualCharacter = "warm-neutral";
    let people = false;
    let commerce = false;
    let delivery = false;
    let route = false;
    let recommendedRoutes = ["/"];
    let recommendedScenes = [];
    let cropIntentDesktop = "optical-center";
    let cropIntentMobile = "portrait-slice";
    let textSafeRegion = "center-clear";
    let transitionSuitability = false;
    let priority = 2;
    let altText = "";

    // 1. Food & Grocery
    if (p.categoryId === "food-grocery") {
      commerce = true;
      recommendedRoutes = ["/services/grocery", "/services/food", "/services/ecommerce", "/"];
      if (f.includes("market-fruit")) {
        semanticId = "photo.grocery.fruit-crates-overhead";
        subject = "Fresh stacked South African fruit crates at morning market";
        altText = "Crates of fresh South African market fruit ready for local grocery dispatch";
        priority = 1;
        recommendedScenes = ["scene-03-trailer-commerce", "scene-04-image-fan"];
        cropIntentDesktop = "full-bleed";
      } else if (f.includes("market-vegetables")) {
        semanticId = "photo.grocery.vegetables-crate";
        subject = "Crisp farm vegetables in wooden market boxes";
        altText = "Farm fresh greens and market vegetables packed for delivery";
        priority = 1;
        recommendedScenes = ["scene-03-trailer-commerce", "scene-04-image-fan"];
      } else if (f.includes("food-bowl")) {
        semanticId = "photo.food.prepared-grain-bowl";
        subject = "Warm freshly prepared artisan grain bowl";
        altText = "Artisan grain bowl prepared in local kitchen for rapid delivery";
        priority = 1;
        recommendedScenes = ["scene-03-trailer-commerce", "scene-04-image-fan"];
      } else if (f.includes("pelzer")) {
        semanticId = "photo.grocery.organic-greens-table";
        subject = "Organic leafy vegetables and root vegetables flat lay";
        altText = "Fresh organic vegetables arranged on kitchen preparation counter";
        priority = 2;
      } else if (f.includes("allison-saeng")) {
        semanticId = "photo.grocery.market-counter-produce";
        subject = "Local green grocery produce display";
        altText = "Fresh market produce arranged for daily neighborhood fulfillment";
        priority = 2;
      } else if (f.includes("nick-karvounis")) {
        semanticId = "photo.food.kitchen-plating-pass";
        subject = "Chef plating hot culinary orders in commercial kitchen";
        altText = "Commercial kitchen chef preparing warm orders for delivery dispatch";
        priority = 1;
        people = true;
      } else if (f.includes("roberto-sorin")) {
        semanticId = "photo.food.fresh-baking-bread";
        subject = "Freshly baked artisan loaves and rustic ingredients";
        altText = "Warm artisan bread loaves ready for early morning route dispatch";
        priority = 2;
      } else if (f.includes("3hrjvdmsd8y")) {
        semanticId = "photo.grocery.wholesale-produce-storage";
        subject = "Wholesale fresh produce cold storage and sorting";
        altText = "Fresh produce sorting crates in temperature controlled hub";
        priority = 3;
      } else if (f.includes("6uspkkg3fvk")) {
        semanticId = "photo.grocery.market-stall-basket";
        subject = "Artisan market grocery basket and organic goods";
        altText = "Organic goods in market baskets ready for collection";
        priority = 3;
      } else if (f.includes("bby6amj8b_i")) {
        semanticId = "photo.food.restaurant-dispatch-counter";
        subject = "Thermal food container sealed for courier handover";
        altText = "Thermal food container staged for courier pickup";
        priority = 2;
      }
    }

    // 2. Fashion & Retail
    else if (p.categoryId === "fashion-retail") {
      commerce = true;
      recommendedRoutes = ["/services/ecommerce", "/services/business", "/"];
      if (f.includes("brown-coat")) {
        semanticId = "photo.fashion.jhb-editorial-coat";
        subject = "Johannesburg street fashion brown coat portrait";
        altText = "Contemporary Johannesburg street fashion brown coat editorial";
        priority = 1;
        people = true;
        recommendedScenes = ["scene-03-trailer-commerce", "scene-04-image-fan"];
      } else if (f.includes("white-top")) {
        semanticId = "photo.fashion.jhb-editorial-white";
        subject = "South African urban fashion white apparel";
        altText = "South African urban apparel and streetwear editorial";
        priority = 1;
        people = true;
        recommendedScenes = ["scene-03-trailer-commerce", "scene-04-image-fan"];
      } else if (f.includes("graffiti")) {
        semanticId = "photo.fashion.jhb-street-graffiti";
        subject = "Street fashion model against urban Johannesburg wall";
        altText = "Urban South African fashion portrait against textured city wall";
        priority = 2;
        people = true;
      } else if (f.includes("rosebank-bags")) {
        semanticId = "photo.fashion.rosebank-leather-bags";
        subject = "Handcrafted leather bags and travel accessories at Rosebank";
        altText = "Artisan leather bags and goods at Rosebank market ready for dispatch";
        priority = 1;
        recommendedScenes = ["scene-03-trailer-commerce", "scene-04-image-fan"];
      } else if (f.includes("rosebank-jewelry")) {
        semanticId = "photo.fashion.rosebank-handcrafted-jewelry";
        subject = "Intricate handcrafted jewelry and accessories display";
        altText = "Handmade artisan jewelry display at Johannesburg craft market";
        priority = 1;
        recommendedScenes = ["scene-03-trailer-commerce", "scene-04-image-fan"];
      } else if (f.includes("adly-hakim")) {
        semanticId = "photo.fashion.boutique-garment-rack";
        subject = "Designer garment rack in local fashion boutique";
        altText = "Curated apparel hanging on boutique rack for order packaging";
        priority = 2;
      } else if (f.includes("bayu-syaits")) {
        semanticId = "photo.fashion.retail-store-front";
        subject = "Independent clothing retail store interior";
        altText = "Independent boutique interior with curated seasonal fashion";
        priority = 2;
      } else if (f.includes("j4o98b3j5uq")) {
        semanticId = "photo.fashion.designer-footwear-leather";
        subject = "Handmade leather footwear and crafted accessories";
        altText = "Artisan leather goods and handcrafted footwear staged for shipping";
        priority = 2;
      } else if (f.includes("jrtzotuic58")) {
        semanticId = "photo.fashion.tailored-textile-detail";
        subject = "High quality textile weave and tailoring detail";
        altText = "Tailored garment craftsmanship detail for luxury retail courier";
        priority = 3;
      } else if (f.includes("k1ecjqo9yes")) {
        semanticId = "photo.fashion.boutique-fitting-studio";
        subject = "Local fashion designer studio and cutting table";
        altText = "Fashion design studio workspace with finished items ready for delivery";
        priority = 3;
      }
    }

    // 3. Wellness & Pharmacy
    else if (p.categoryId === "wellness-pharmacy") {
      commerce = true;
      recommendedRoutes = ["/services/pharmacy", "/services/ecommerce", "/"];
      if (f.includes("karolina-grabowska-aerjba")) {
        semanticId = "photo.wellness.amber-apothecary-bottles";
        subject = "Amber glass botanical bottles and essential oils";
        altText = "Amber glass apothecary droppers and botanical wellness formulations";
        priority = 1;
        recommendedScenes = ["scene-03-trailer-commerce", "scene-04-image-fan"];
      } else if (f.includes("karolina-grabowska-vqjt")) {
        semanticId = "photo.wellness.herbal-jars-dispensary";
        subject = "Herbal cosmetic jars and natural wellness creams";
        altText = "Natural botanical creams and skincare jars arranged for dispatch";
        priority = 1;
        recommendedScenes = ["scene-03-trailer-commerce", "scene-04-image-fan"];
      } else if (f.includes("ela-de-pure")) {
        semanticId = "photo.wellness.organic-botanical-serum";
        subject = "Organic botanical skincare serum in glass vial";
        altText = "Sealed organic botanical skincare serum ready for express transit";
        priority = 1;
        recommendedScenes = ["scene-03-trailer-commerce", "scene-04-image-fan"];
      } else if (f.includes("declan-sun")) {
        semanticId = "photo.wellness.minimalist-wellness-bottles";
        subject = "Minimalist apothecary bottles against warm neutral backdrop";
        altText = "Minimalist wellness dropper bottles on warm paper-toned surface";
        priority = 1;
        recommendedScenes = ["scene-03-trailer-commerce", "scene-04-image-fan"];
      } else if (f.includes("drkiawammok")) {
        semanticId = "photo.wellness.licensed-pharmacy-counter";
        subject = "Professional licensed pharmacy custody counter";
        altText = "Licensed pharmacy dispensary counter with verified sealed packages";
        priority = 2;
        delivery = true;
      } else if (f.includes("ov2h8nh6cog")) {
        semanticId = "photo.wellness.botanical-extract-compounding";
        subject = "Botanical compounding station with glass beakers and pipettes";
        altText = "Laboratory compounding station for natural pharmaceutical products";
        priority = 2;
      } else if (f.includes("sa0cuvlc2kg")) {
        semanticId = "photo.wellness.temperature-sensitive-pack";
        subject = "Sealed temperature monitored parcel for medical courier";
        altText = "Secure sealed medical supply container staged for verified courier custody";
        priority = 2;
        delivery = true;
      }
    }

    // 4. Route, Road & Aerial Geography
    else if (p.categoryId === "route-road-aerial") {
      route = true;
      recommendedRoutes = ["/", "/coverage-areas", "/about", "/services/shuttle", "/services/freight"];
      visualCharacter = "cinematic-aerial";
      if (f.includes("9o5zes6qbgm")) {
        semanticId = "photo.route.gauteng-transit-corridor";
        subject = "Gauteng highway arterial interchange aerial perspective";
        altText = "Aerial perspective over Gauteng transit highway corridor";
        priority = 1;
        recommendedScenes = ["scene-07-route-aerial"];
        cropIntentDesktop = "full-bleed";
      } else if (f.includes("hbunteuflfo")) {
        semanticId = "photo.route.night-highway-transit";
        subject = "Night transit long exposure highway light trails";
        altText = "Night transit freight route with vehicle light trails across highway";
        priority = 1;
        recommendedScenes = ["scene-07-route-aerial", "scene-08-freight-scale"];
      } else if (f.includes("pgsm_blvwlo")) {
        semanticId = "photo.route.johannesburg-street-grid";
        subject = "Johannesburg metropolitan street level commercial grid";
        altText = "Johannesburg urban commercial street network";
        priority = 1;
      } else if (f.includes("uh0w8uqr_3c")) {
        semanticId = "photo.route.metropolitan-freeway-flyover";
        subject = "High speed metropolitan freeway flyover";
        altText = "Metropolitan highway flyover supporting regional freight logistics";
        priority = 1;
      } else if (f.includes("v0pemz63om8")) {
        semanticId = "photo.route.regional-arterial-connector";
        subject = "Regional arterial road connecting logistics distribution nodes";
        altText = "Regional arterial road connecting Gauteng distribution hubs";
        priority = 1;
      } else if (f.includes("mavic")) {
        semanticId = "photo.route.overhead-cloverleaf-interchange";
        subject = "Geometric highway cloverleaf interchange top down";
        altText = "Geometric highway interchange connecting north-south logistics corridors";
        priority = 1;
        recommendedScenes = ["scene-07-route-aerial"];
      } else if (f.includes("chuttersnap")) {
        semanticId = "photo.route.long-haul-freeway-vista";
        subject = "Expansive long haul freight freeway extending to horizon";
        altText = "Long haul freight transport freeway extending across landscape";
        priority = 1;
      } else if (f.includes("cape-town-road-night")) {
        semanticId = "photo.route.cape-town-coastal-transit";
        subject = "Cape Town metropolitan transit route at night";
        altText = "Cape Town commercial transit route connecting harbor and urban nodes";
        priority = 2;
      } else if (f.includes("jhb-urban-aerial")) {
        semanticId = "photo.route.johannesburg-skyline-aerial";
        subject = "Johannesburg CBD and logistics rail corridor aerial";
        altText = "Johannesburg commercial core and logistics rail corridors from above";
        priority = 2;
      } else if (f.includes("casey-horner")) {
        semanticId = "photo.route.mountain-pass-arterial";
        subject = "High altitude mountain pass transport route";
        altText = "Trans-regional mountain pass road under evening light";
        priority = 3;
      } else if (f.includes("ey449nzwjco")) {
        semanticId = "photo.route.cross-country-freight-road";
        subject = "Open straight freight highway across South African plateau";
        altText = "Open freight highway stretching across South African highveld";
        priority = 1;
        recommendedScenes = ["scene-08-freight-scale"];
      } else if (f.includes("fnfsncrrujc")) {
        semanticId = "photo.route.freight-dusk-transit";
        subject = "Long haul logistics highway under deep cinematic dusk";
        altText = "Freight transport highway under dusk sky";
        priority = 3;
      }
    }

    // 5. Warehouse & Freight
    else if (p.categoryId === "warehouse-freight") {
      route = true;
      commerce = true;
      recommendedRoutes = ["/services/freight", "/services/moving", "/services/business", "/"];
      visualCharacter = "high-carbon";
      if (f.includes("renato-leal")) {
        semanticId = "photo.freight.distribution-center-pallets";
        subject = "Heavy wooden cargo pallets stacked in distribution terminal";
        altText = "Industrial cargo pallets stacked in high-capacity distribution warehouse";
        priority = 1;
        recommendedScenes = ["scene-08-freight-scale"];
      } else if (f.includes("jonathan-castaneda")) {
        semanticId = "photo.freight.high-bay-warehouse-racking";
        subject = "High bay industrial warehouse racking and freight aisles";
        altText = "High bay warehouse storage facility for commercial pallet logistics";
        priority = 1;
        recommendedScenes = ["scene-08-freight-scale"];
      } else if (f.includes("martijn-baudoin")) {
        semanticId = "photo.freight.loading-dock-freight-doors";
        subject = "Heavy freight trailer loading docks with roll up doors";
        altText = "Logistics terminal loading bays ready for heavy truck docking";
        priority = 1;
        recommendedScenes = ["scene-08-freight-scale"];
      } else if (f.includes("yunus-tug")) {
        semanticId = "photo.freight.intermodal-container-depot";
        subject = "Shipping container depot and intermodal freight cranes";
        altText = "Intermodal shipping container yard with freight transfer cranes";
        priority = 2;
      } else if (f.includes("0jv3iso_ivc")) {
        semanticId = "photo.freight.heavy-forklift-pallet-transfer";
        subject = "Heavy forklift operator moving cargo pallet across staging floor";
        altText = "Forklift lifting industrial palletized freight in transit hub";
        priority = 1;
        people = true;
        recommendedScenes = ["scene-08-freight-scale"];
      } else if (f.includes("14wslu0sib0")) {
        semanticId = "photo.freight.freight-sorting-conveyor-bay";
        subject = "Automated high volume parcel sorting conveyor line";
        altText = "High volume sorting terminal routing parcels to regional trucks";
        priority = 3;
      } else if (f.includes("6_czswwhzak")) {
        semanticId = "photo.freight.commercial-freight-staging-deck";
        subject = "Commercial cargo crates staged for line haul departure";
        altText = "Crated cargo staged on loading deck for night transport departure";
        priority = 2;
      } else if (f.includes("a_y9biqs7zy")) {
        semanticId = "photo.freight.fleet-maintenance-hangar";
        subject = "Heavy commercial truck fleet maintenance depot";
        altText = "Fleet service bay maintaining long haul commercial vehicles";
        priority = 2;
      } else if (f.includes("cn2yh0gjllg")) {
        semanticId = "photo.freight.industrial-pallet-aisle";
        subject = "Forklift moving down tall industrial storage aisle";
        altText = "Warehouse forklift operating in high capacity storage aisle";
        priority = 3;
        people = true;
      } else if (f.includes("fhww8w67teo")) {
        semanticId = "photo.freight.cross-docking-dispatch-floor";
        subject = "Active cross-docking dispatch floor with pallets in transit";
        altText = "Cross-dock logistics transfer floor moving regional cargo";
        priority = 3;
      }
    }

    // 6. Courier & Human Logistics
    else if (p.categoryId === "courier-human") {
      delivery = true;
      people = true;
      recommendedRoutes = ["/services/parcel", "/services/driver-network", "/join", "/about", "/"];
      if (f.includes("r2-doc-02")) {
        semanticId = "photo.courier.doorstep-driver-arrival";
        subject = "Courier arriving at recipient doorstep holding verified parcel";
        altText = "KT Courier arriving at destination doorstep with customer package";
        priority = 1;
        recommendedScenes = ["scene-09-arrival-resolution"];
      } else if (f.includes("r2-doc-03")) {
        semanticId = "photo.courier.merchant-pickup-handoff";
        subject = "Direct custody transfer from merchant counter to courier";
        altText = "Courier verifying barcode manifest during merchant collection";
        priority = 1;
        recommendedScenes = ["scene-06-custody-split"];
      } else if (f.includes("r2-doc-05")) {
        semanticId = "photo.courier.digital-manifest-check";
        subject = "Driver checking route optimization and delivery manifest on phone";
        altText = "Driver verifying digital dispatch route manifest beside vehicle";
        priority = 1;
        recommendedScenes = ["scene-06-custody-split"];
      } else if (f.includes("r2-doc-06")) {
        semanticId = "photo.courier.recipient-physical-handoff";
        subject = "Close up handshake and package exchange with recipient";
        altText = "Close up physical parcel exchange between courier and customer";
        priority = 1;
        recommendedScenes = ["scene-09-arrival-resolution"];
      } else if (f.includes("kt-auth-01")) {
        semanticId = "photo.courier.recipient-receiving-delivery";
        subject = "Smiling customer receiving packaged goods at doorway";
        altText = "Customer receiving delivered goods safely at front entrance";
        priority = 1;
      } else if (f.includes("fitnish-media-c77n")) {
        semanticId = "photo.courier.south-african-driver-route";
        subject = "South African delivery driver in active transit";
        altText = "Independent delivery partner managing route across Johannesburg";
        priority = 1;
      } else if (f.includes("fitnish-media-mq2m")) {
        semanticId = "photo.courier.delivery-team-portrait";
        subject = "Professional courier team member ready for daily route";
        altText = "Professional KT Courier driver partner at dispatch depot";
        priority = 1;
      } else if (f.includes("alex-reynolds")) {
        semanticId = "photo.courier.urban-express-cyclist";
        subject = "Urban express courier navigating metropolitan street traffic";
        altText = "Rapid city courier providing zero-emission local transit";
        priority = 2;
      } else if (f.includes("aleksandrs-karevs")) {
        semanticId = "photo.courier.dispatch-staging-worker";
        subject = "Logistics staff loading van at morning departure gate";
        altText = "Courier driver loading packages into delivery van cargo hold";
        priority = 2;
      } else if (f.includes("olivier-drouin")) {
        semanticId = "photo.courier.neighborhood-delivery-walk";
        subject = "Courier walking down quiet suburban lane with parcel";
        altText = "Courier completing final 50 meters on foot to residential address";
        priority = 2;
      } else if (f.includes("beauty-van-stam")) {
        semanticId = "photo.courier.fleet-driver-portrait";
        subject = "Van driver in driver seat preparing delivery navigation";
        altText = "KT Courier driver partner preparing route navigation in cab";
        priority = 3;
      } else if (f.includes("graddes-8puq")) {
        semanticId = "photo.courier.street-handoff-motion";
        subject = "Fast paced package delivery handoff on busy sidewalk";
        altText = "Active courier completing rapid package delivery on city street";
        priority = 3;
      }
    }

    // 7. Merchant Preparation & Packing
    else if (p.categoryId === "merchant-preparation") {
      commerce = true;
      people = true;
      recommendedRoutes = ["/services/ecommerce", "/services/business", "/about", "/"];
      if (f.includes("kt-auth-02")) {
        semanticId = "photo.prep.artisan-box-assembly";
        subject = "Artisan merchant assembling kraft delivery box at workshop table";
        altText = "Artisan workshop merchant taping and assembling branded shipping box";
        priority = 1;
        recommendedScenes = ["scene-05-prep-documentary"];
      } else if (f.includes("r2-net-01")) {
        semanticId = "photo.prep.store-staging-shelves";
        subject = "Retail store staging area with packaged orders ready for van";
        altText = "Retail store counter with verified orders staged for driver pickup";
        priority = 1;
        recommendedScenes = ["scene-05-prep-documentary"];
      } else if (f.includes("andrej-lisakov")) {
        semanticId = "photo.prep.wrapping-protective-packaging";
        subject = "Hands carefully wrapping fragile ceramics in protective kraft paper";
        altText = "Hands wrapping delicate craft items in protective packaging";
        priority = 1;
        recommendedScenes = ["scene-05-prep-documentary"];
      } else if (f.includes("andy-quezada")) {
        semanticId = "photo.prep.boxing-finished-apparel";
        subject = "Folding garments neatly into corrugated shipping carton";
        altText = "Boutique merchant neatly boxing apparel into shipping box";
        priority = 1;
        recommendedScenes = ["scene-05-prep-documentary"];
      } else if (f.includes("ramses-cervantes-jp47")) {
        semanticId = "photo.prep.artisan-woodwork-labeling";
        subject = "Craftsperson applying shipping label to wooden item package";
        altText = "Artisan workshop owner attaching delivery barcode to package";
        priority = 1;
        recommendedScenes = ["scene-05-prep-documentary"];
      } else if (f.includes("ramses-cervantes-u6ua")) {
        semanticId = "photo.prep.leather-goods-boxing";
        subject = "Packing handmade leather wallet and belt into gift packaging";
        altText = "Merchant packaging bespoke leather goods for courier pickup";
        priority = 1;
      } else if (f.includes("ramses-cervantes-wxzg")) {
        semanticId = "photo.prep.workshop-dispatch-desk";
        subject = "Artisan workshop workbench with finished orders ready for courier";
        altText = "Craft studio workbench with packaged shipments ready for collection";
        priority = 1;
      } else if (f.includes("maboneng-vehicle-workshop")) {
        semanticId = "photo.prep.maboneng-fleet-depot";
        subject = "Fleet preparation workshop in Maboneng, Johannesburg";
        altText = "Vehicle fleet preparation workshop in Maboneng, Johannesburg";
        priority = 2;
        route = true;
      } else if (f.includes("evelyn-verdin")) {
        semanticId = "photo.prep.boutique-gift-wrapping";
        subject = "Boutique retail specialist securing ribbon on parcel box";
        altText = "Boutique owner finalizing secure presentation wrapping on package";
        priority = 3;
      } else if (f.includes("polina-kuzovkova")) {
        semanticId = "photo.prep.cosmetics-order-fulfillment";
        subject = "Packing natural cosmetic jars into padded shipping mailer";
        altText = "Ecommerce staff fulfilling natural cosmetics orders in warehouse";
        priority = 3;
      }
    }

    // 8. Community Markets & Urban Life
    else if (p.categoryId === "community-market") {
      commerce = true;
      people = true;
      recommendedRoutes = ["/about", "/coverage-areas", "/join", "/"];
      if (f.includes("rosebank-market-craft")) {
        semanticId = "photo.market.rosebank-craft-stalls";
        subject = "Vibrant Rosebank craft market stalls and African woodwork";
        altText = "Rosebank Sunday craft market stalls showcasing local South African wares";
        priority = 1;
      } else if (f.includes("rosebank-market-interaction")) {
        semanticId = "photo.market.rosebank-merchant-dialogue";
        subject = "Artisan merchant conversing with neighborhood market customer";
        altText = "Local artisan merchant and buyer exchanging goods at community market";
        priority = 1;
      } else if (f.includes("rosebank-market-people")) {
        semanticId = "photo.market.rosebank-busy-pathway";
        subject = "Patrons strolling through lively sunlit market pavilion";
        altText = "Community patrons walking through vibrant open-air market";
        priority = 1;
      } else if (f.includes("rosebank-plants")) {
        semanticId = "photo.market.rosebank-succulents-nursery";
        subject = "Potted succulents and indigenous South African plants at market";
        altText = "Potted indigenous succulents and plants displayed at local market";
        priority = 2;
      } else if (f.includes("unsplash-community")) {
        semanticId = "photo.market.neighborhood-community-gathering";
        subject = "Diverse neighborhood community gathering at street event";
        altText = "Local community gathering supporting small neighborhood commerce";
        priority = 3;
      } else if (f.includes("olivie-strauss-7lwz")) {
        semanticId = "photo.market.south-african-social-exchange";
        subject = "South African outdoor gathering and cultural conversation";
        altText = "South African outdoor community space with local entrepreneurs";
        priority = 1;
      } else if (f.includes("olivie-strauss-oo85")) {
        semanticId = "photo.market.local-artisan-portrait";
        subject = "Portrait of local South African craft creator in market stall";
        altText = "Local craft creator standing proudly beside handmade goods";
        priority = 1;
      } else if (f.includes("fellipe-ditadi-hzj0")) {
        semanticId = "photo.market.urban-merchant-street";
        subject = "Bustling city street with ground floor retail and sidewalk trade";
        altText = "Vibrant urban commercial street with small retail storefronts";
        priority = 2;
      } else if (f.includes("fellipe-ditadi-ke9b")) {
        semanticId = "photo.market.weekend-fair-awnings";
        subject = "Canvas market awnings covering handcrafted jewelry tables";
        altText = "Weekend artisan market with covered vendor booths";
        priority = 2;
      } else if (f.includes("fellipe-ditadi-ynno")) {
        semanticId = "photo.market.small-business-entryway";
        subject = "Charming independent neighborhood storefront entrance";
        altText = "Independent neighborhood storefront ready for morning courier pickup";
        priority = 3;
      } else if (f.includes("zero-oukibt")) {
        semanticId = "photo.market.corner-store-morning";
        subject = "Morning sunlight hitting corner grocery and flower bucket";
        altText = "Corner neighborhood market in early morning light";
        priority = 3;
      } else if (f.includes("ubaid-e-alyafizi")) {
        semanticId = "photo.market.fresh-produce-bazaar";
        subject = "Colorful spices and dried goods piled high at market stall";
        altText = "Aromatic market stall with dry spices and regional goods";
        priority = 3;
      }
    }

    // 9. Editorial & Commerce (Ceramics, Homeware, Curated Retail)
    else {
      commerce = true;
      recommendedRoutes = ["/services/ecommerce", "/services/moving", "/about", "/"];
      if (f.includes("vitaly-gariev")) {
        semanticId = "photo.commerce.sculptural-ceramics-vessel";
        subject = "Sculptural handcrafted ceramic vessel on warm stone";
        altText = "Handcrafted architectural ceramic vessel for fragile courier transport";
        priority = 1;
        recommendedScenes = ["scene-03-trailer-commerce", "scene-04-image-fan"];
      } else if (f.includes("natalia-blauth-43i1")) {
        semanticId = "photo.commerce.pottery-studio-shelving";
        subject = "Rows of drying handmade clay pots and stoneware ceramics";
        altText = "Artisan ceramics studio drying shelves with pottery awaiting packaging";
        priority = 1;
        recommendedScenes = ["scene-03-trailer-commerce", "scene-04-image-fan"];
      } else if (f.includes("natalia-blauth-4xiv")) {
        semanticId = "photo.commerce.stoneware-tableware-collection";
        subject = "Glazed stoneware tableware set arranged on textured wood";
        altText = "Stoneware plates and handcrafted bowls for boutique home delivery";
        priority = 1;
        recommendedScenes = ["scene-03-trailer-commerce", "scene-04-image-fan"];
      } else if (f.includes("natalia-blauth-n6dp")) {
        semanticId = "photo.commerce.ceramic-vase-sculpture";
        subject = "Minimalist white textured ceramic vase in natural light";
        altText = "Minimalist handcrafted ceramic vase displayed on neutral plinth";
        priority = 2;
      } else if (f.includes("market-ceramics")) {
        semanticId = "photo.commerce.cape-town-market-ceramics";
        subject = "Cape Town handcrafted ceramic plates and decorative bowls";
        altText = "Artisanal ceramic tableware from Cape Town market makers";
        priority = 1;
        recommendedScenes = ["scene-03-trailer-commerce", "scene-04-image-fan"];
      } else if (f.includes("curated-lifestyle-3k9d")) {
        semanticId = "photo.commerce.lifestyle-design-showroom";
        subject = "Curated home goods and artisanal furniture showroom";
        altText = "Independent lifestyle design showroom with curated interior objects";
        priority = 3;
      } else if (f.includes("curated-lifestyle-gbk")) {
        semanticId = "photo.commerce.minimal-interior-homeware";
        subject = "Warm textured linen textiles and natural interior wares";
        altText = "Natural textiles and home goods packaged for residential delivery";
        priority = 3;
      } else if (f.includes("sumup")) {
        semanticId = "photo.commerce.independent-retail-pos";
        subject = "Card reader and retail counter in neighborhood store";
        altText = "Modern contactless checkout at local merchant storefront";
        priority = 3;
        people = true;
      } else if (f.includes("kt-auth-03")) {
        semanticId = "photo.commerce.clean-packaged-goods-stack";
        subject = "Stack of neatly packaged goods with security seals";
        altText = "Branded parcels and curated retail goods ready for shipping";
        priority = 1;
      } else if (f.includes("kt-auth-04")) {
        semanticId = "photo.auth.recovery-keycard";
        subject = "Secure customer recovery and verification credentials";
        altText = "Secure account verification and recovery authentication visual";
        priority = 2;
        recommendedRoutes = ["/forgot-password", "/verify-otp"];
      } else if (f.includes("nrd-d6tu")) {
        semanticId = "photo.commerce.coffee-roastery-counter";
        subject = "Specialty coffee beans and retail packaging in roastery";
        altText = "Local coffee roastery beans and bags prepared for dispatch";
        priority = 2;
      } else {
        semanticId = `photo.editorial.${f.replace(/\.[^.]+$/, "").replace(/[^a-z0-9_-]+/g, "-")}`;
        subject = `Editorial photographic reference ${p.filename}`;
        altText = `Editorial documentary photography ${p.filename}`;
        priority = 3;
      }
    }

    if (!semanticId) {
      semanticId = `photo.asset.${f.replace(/\.[^.]+$/, "").replace(/[^a-z0-9_-]+/g, "-")}`;
    }

    selections.push({
      semanticId,
      filename: p.filename,
      sourcePath: `public/media/public/images/${p.relPath}`,
      category: p.categoryId,
      subject,
      orientation: p.orientation,
      dimensions: { width: p.width, height: p.height },
      aspectRatio: p.aspectRatio,
      visualCharacter,
      people,
      commerce,
      delivery,
      route,
      recommendedRoutes,
      recommendedScenes,
      cropIntentDesktop,
      cropIntentMobile,
      textSafeRegion,
      transitionSuitability: p.aspectRatio >= 1.3,
      priority,
      altText: altText || subject,
    });
  }

  // Filter for high and medium priority approved runtime candidates (68 chosen candidates)
  const approvedCandidates = selections.filter(s => s.priority <= 2);
  console.log(`Curated ${approvedCandidates.length} high/medium priority photographic candidates for runtime.`);
  return approvedCandidates;
}

main().catch((err) => {
  console.error("Failed to build contact sheets:", err);
  process.exit(1);
});
