import { readdir, stat, writeFile, mkdir } from "node:fs/promises";
import crypto from "node:crypto";
import path from "node:path";
import sharp from "sharp";

const rootDir = process.cwd();
const mediaImagesDir = path.join(rootDir, "public", "media", "public", "images");
const artifactsMediaDir = path.join(rootDir, "artifacts", "media");

async function hashFile(filePath) {
  const fileBuffer = await sharp(filePath).toBuffer();
  return crypto.createHash("md5").update(fileBuffer).digest("hex");
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

// Visual and semantic classification dictionary
function classifyAsset(relPath, filename, meta, hash) {
  const isSvg = /\.svg$/i.test(filename);
  const width = meta.width || 0;
  const height = meta.height || 0;
  const aspectRatio = height > 0 ? Number((width / height).toFixed(3)) : 1;
  const orientation = aspectRatio > 1.15 ? "landscape" : aspectRatio < 0.85 ? "portrait" : "square";
  const hasAlpha = Boolean(meta.hasAlpha);

  // Default values
  let id = filename.replace(/\.[^/.]+$/, "").toLowerCase().replace(/[^a-z0-9_-]+/g, "-");
  let semanticRole = "quiet-utility";
  let sceneCandidates = [];
  let routeCandidates = ["/"];
  let focalPoint = [0.5, 0.5];
  let desktopCrop = "optical-center";
  let mobileCrop = "portrait-slice";
  let textSafeRegion = "center-clear";
  let transitionSuitability = false;
  let parallaxSuitability = false;
  let maskSuitability = false;
  let colorCharacter = "warm-neutral";
  let visualPriority = 3;
  let duplicateGroup = undefined;
  let approvedForRuntime = false;
  let altText = "";

  // 1. White Truck Protagonist Pack (16 PNGs)
  if (relPath.startsWith("white_truck_asset_pack_16_images/")) {
    semanticRole = "protagonist-machine";
    transitionSuitability = true;
    parallaxSuitability = true;
    maskSuitability = true;
    colorCharacter = "warm-neutral";
    visualPriority = 1;
    approvedForRuntime = true;
    routeCandidates = ["/", "/services", "/coverage-areas"];

    if (filename.includes("01_full_side_view_facing_right")) {
      id = "protagonist.truck.white.side-right";
      sceneCandidates = ["scene-02-hero", "scene-03-entry", "scene-04-inertia", "scene-12-network"];
      altText = "KT Couriers long haul transport truck side profile facing right";
      focalPoint = [0.5, 0.55];
      desktopCrop = "baseline-ground";
    } else if (filename.includes("02_full_side_view_facing_left")) {
      id = "protagonist.truck.white.side-left";
      sceneCandidates = ["scene-12-network", "scene-14-finale"];
      altText = "KT Couriers long haul transport truck side profile facing left";
      focalPoint = [0.5, 0.55];
      desktopCrop = "baseline-ground";
    } else if (filename.includes("03_centered_hero_side_view")) {
      id = "protagonist.truck.white.centered-hero";
      sceneCandidates = ["scene-02-hero", "hero-still"];
      altText = "KT Couriers flagship long white truck centered hero profile";
      focalPoint = [0.5, 0.55];
      desktopCrop = "optical-center";
    } else if (filename.includes("04_front_three_quarter_view_facing_right")) {
      id = "protagonist.truck.white.front-3q-right";
      sceneCandidates = ["scene-03-entry", "scene-12-network"];
      altText = "Front three-quarter view of KT white truck approaching";
      focalPoint = [0.45, 0.5];
    } else if (filename.includes("05_front_three_quarter_view_facing_left")) {
      id = "protagonist.truck.white.front-3q-left";
      sceneCandidates = ["scene-12-network"];
      altText = "Front three-quarter view of KT white truck angled left";
      focalPoint = [0.55, 0.5];
    } else if (filename.includes("08_top_down_view")) {
      id = "protagonist.truck.white.top-down-straight";
      sceneCandidates = ["scene-11-route-tracking"];
      altText = "Top-down view of KT Couriers white freight truck in transit corridor";
      routeCandidates = ["/", "/coverage-areas"];
      focalPoint = [0.5, 0.5];
    } else if (filename.includes("12_close_crop_long_cargo_box_only")) {
      id = "protagonist.truck.white.cargo-box-material";
      sceneCandidates = ["scene-05-trailer-takeover"];
      altText = "Close crop of white trailer side panel acting as transition surface";
      transitionSuitability = true;
      focalPoint = [0.5, 0.5];
    } else if (filename.includes("16_top_down_turning_curve_transition")) {
      id = "protagonist.truck.white.top-down-turning";
      sceneCandidates = ["scene-11-route-tracking"];
      altText = "Top-down view of KT freight truck navigating regional transit turn";
      routeCandidates = ["/", "/coverage-areas"];
      focalPoint = [0.5, 0.5];
    } else {
      id = `protagonist.truck.white.${filename.replace(/^[0-9]+_/, '').replace(/\.png$/, '').replace(/_/g, '-')}`;
      sceneCandidates = ["scene-12-network"];
      altText = `KT Couriers fleet truck asset ${filename}`;
    }
  }

  // 2. KT Courier Van Asset Pack (14 PNGs)
  else if (relPath.startsWith("KT_Courier_Van_Asset_Pack_14_PNGs/")) {
    semanticRole = "protagonist-lastmile";
    transitionSuitability = true;
    parallaxSuitability = true;
    maskSuitability = true;
    colorCharacter = "warm-neutral";
    visualPriority = 1;
    approvedForRuntime = true;
    routeCandidates = ["/", "/services/parcel", "/services/food", "/services/grocery"];

    if (filename.includes("01_full_side_view_facing_right")) {
      id = "protagonist.van.side-right";
      sceneCandidates = ["scene-09-local-collection"];
      altText = "KT Couriers neighborhood delivery van side view";
      focalPoint = [0.5, 0.5];
    } else if (filename.includes("10_side_sliding_door_open")) {
      id = "protagonist.van.sliding-door-open";
      sceneCandidates = ["scene-09-local-collection", "scene-10-handoff"];
      altText = "KT delivery van with sliding side door open for parcel staging";
      focalPoint = [0.55, 0.5];
    } else if (filename.includes("11_rear_doors_open")) {
      id = "protagonist.van.rear-doors-open";
      sceneCandidates = ["scene-09-local-collection"];
      altText = "KT delivery van rear cargo doors open ready for loading";
      focalPoint = [0.5, 0.5];
    } else if (filename.includes("12_side_and_rear_doors_open")) {
      id = "protagonist.van.all-doors-open";
      sceneCandidates = ["scene-09-local-collection"];
      altText = "KT delivery van open for neighborhood merchant collection";
      focalPoint = [0.5, 0.5];
    } else if (filename.includes("07_centered_hero_version")) {
      id = "protagonist.van.centered-hero";
      sceneCandidates = ["services-local-hero"];
      routeCandidates = ["/services/parcel", "/services/grocery"];
      altText = "KT Couriers local delivery vehicle centered hero view";
      focalPoint = [0.5, 0.5];
    } else {
      id = `protagonist.van.${filename.replace(/^[0-9]+_/, '').replace(/\.png$/, '').replace(/_/g, '-')}`;
      sceneCandidates = ["scene-09-local-collection"];
      altText = `KT Couriers delivery van asset ${filename}`;
    }
  }

  // 3. Red Truck Asset Pack (12 PNGs)
  else if (relPath.startsWith("truck_asset_pack_12_images/")) {
    semanticRole = "protagonist-freight";
    transitionSuitability = true;
    parallaxSuitability = true;
    maskSuitability = true;
    colorCharacter = "high-carbon";
    visualPriority = 2;
    approvedForRuntime = true;
    routeCandidates = ["/", "/services/freight", "/services/moving"];

    if (filename.includes("01_full_side_view_facing_right")) {
      id = "protagonist.truck.red.side-right";
      sceneCandidates = ["scene-12-network", "freight-hero"];
      altText = "KT Couriers heavy freight transport truck with red curtain trailer";
      focalPoint = [0.5, 0.55];
    } else if (filename.includes("07_centered_hero_version")) {
      id = "protagonist.truck.red.centered-hero";
      sceneCandidates = ["scene-12-network", "freight-hero"];
      altText = "Heavy logistics red freight truck centered hero profile";
      focalPoint = [0.5, 0.55];
    } else if (filename.includes("12_trailer_curtain_partially_opened")) {
      id = "protagonist.truck.red.curtain-open";
      sceneCandidates = ["scene-12-network", "freight-capacity"];
      altText = "Red freight truck with cargo trailer curtain partially opened";
      focalPoint = [0.5, 0.55];
    } else {
      id = `protagonist.truck.red.${filename.replace(/^[0-9]+_/, '').replace(/\.png$/, '').replace(/_/g, '-')}`;
      sceneCandidates = ["scene-12-network"];
      altText = `KT Couriers heavy freight truck ${filename}`;
    }
  }

  // 4. KT Courier 20 Transparent PNG Assets (20 PNGs)
  else if (relPath.startsWith("KT_Courier_20_Transparent_PNG_Assets/")) {
    semanticRole = "protagonist-human";
    transitionSuitability = true;
    parallaxSuitability = true;
    maskSuitability = true;
    colorCharacter = "warm-neutral";
    visualPriority = 1;
    approvedForRuntime = true;
    routeCandidates = ["/", "/services/parcel", "/services/driver-network", "/join", "/about", "/safety"];

    if (filename.includes("01_original_pose_refined")) {
      id = "protagonist.courier.hero-standing";
      sceneCandidates = ["scene-10-handoff", "join-driver-hero"];
      altText = "KT Courier standing confidently in uniform holding parcel";
      focalPoint = [0.5, 0.35];
    } else if (filename.includes("02_full_body_one_parcel")) {
      id = "protagonist.courier.carry-one-parcel";
      sceneCandidates = ["scene-09-collection", "scene-10-handoff"];
      altText = "KT Courier carrying parcel ready for transfer";
      focalPoint = [0.5, 0.35];
    } else if (filename.includes("04_walking_one_parcel_facing_right")) {
      id = "protagonist.courier.walk-right-one-parcel";
      sceneCandidates = ["scene-09-collection", "scene-13-arrival"];
      altText = "KT Courier walking briskly to the right delivering a package";
      focalPoint = [0.5, 0.35];
    } else if (filename.includes("07_ready_to_handover_parcel")) {
      id = "protagonist.courier.ready-handover";
      sceneCandidates = ["scene-10-handoff", "scene-13-arrival"];
      altText = "KT Courier preparing to hand over package to customer";
      focalPoint = [0.5, 0.35];
    } else if (filename.includes("08_extending_parcel_for_handoff")) {
      id = "protagonist.courier.extending-handoff";
      sceneCandidates = ["scene-10-handoff", "scene-13-arrival"];
      altText = "KT Courier extending parcel forward completing physical delivery";
      focalPoint = [0.5, 0.35];
    } else if (filename.includes("10_looking_right_approaching_vehicle")) {
      id = "protagonist.courier.approach-vehicle";
      sceneCandidates = ["scene-09-collection"];
      altText = "KT Courier approaching transport van with delivery manifest";
      focalPoint = [0.5, 0.35];
    } else if (filename.includes("18_loading_unloading_parcel")) {
      id = "protagonist.courier.loading-unloading";
      sceneCandidates = ["scene-09-collection", "services-parcel"];
      altText = "KT Courier loading packages into delivery vehicle";
      focalPoint = [0.5, 0.4];
    } else {
      id = `protagonist.courier.${filename.replace(/^[0-9]+_/, '').replace(/\.png$/, '').replace(/_/g, '-')}`;
      sceneCandidates = ["scene-10-handoff", "scene-13-arrival"];
      altText = `KT Courier team member in active delivery pose ${filename}`;
    }
  }

  // 5. Illustration SVGs (19 SVGs)
  else if (relPath.startsWith("illustration/")) {
    semanticRole = "illustration-vector";
    visualPriority = 4;
    approvedForRuntime = true;
    routeCandidates = ["/faq", "/safety", "/contact", "/login", "/signup"];
    altText = `Operational illustration for ${filename.replace(/\.svg$/, '')}`;
    id = `illustration.${filename.replace(/\.svg$/, '').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`;
  }

  // 6. Root Photographic Masters (110 files)
  else {
    // Specific curated South African photojournalism
    if (filename.includes("jhb-rosebank") || filename.includes("cape-town-market") || filename.includes("sa-market") || filename.includes("jhb-fashion")) {
      visualPriority = 1;
      approvedForRuntime = true;
      colorCharacter = "earth-natural";

      if (filename.includes("jhb-rosebank-bags") || filename.includes("rosebank-bags")) {
        id = "market.craft.leather-bags";
        semanticRole = "category-hero";
        sceneCandidates = ["scene-06-marketplace", "scene-07-categories"];
        routeCandidates = ["/shop", "/shop/categories", "/shop/categories/fashion"];
        altText = "Handmade leather bags and accessories at Rosebank artisan market";
      } else if (filename.includes("cape-town-market-vegetables") || filename.includes("sa-market-fruit")) {
        id = "market.produce.fresh-crates";
        semanticRole = "category-hero";
        sceneCandidates = ["scene-06-marketplace", "scene-07-categories"];
        routeCandidates = ["/shop", "/shop/categories", "/shop/categories/groceries"];
        altText = "Farm-fresh vegetables and local produce stacked in market crates";
      } else if (filename.includes("cape-town-market-food-bowl")) {
        id = "market.food.prepared-bowl";
        semanticRole = "category-hero";
        sceneCandidates = ["scene-06-marketplace", "scene-07-categories"];
        routeCandidates = ["/shop", "/shop/categories", "/shop/categories/food-dining"];
        altText = "Freshly prepared healthy grain bowl from a local South African kitchen";
      } else if (filename.includes("cape-town-market-ceramics")) {
        id = "market.craft.ceramics";
        semanticRole = "category-hero";
        sceneCandidates = ["scene-06-marketplace", "scene-07-categories"];
        routeCandidates = ["/shop", "/shop/categories", "/shop/categories/home-living"];
        altText = "Artisanal handcrafted ceramic tableware and home decor";
      } else if (filename.includes("jhb-fashion-brown-coat") || filename.includes("jhb-fashion-white-top")) {
        id = `market.fashion.${filename.replace('.webp', '')}`;
        semanticRole = "merchant-window";
        sceneCandidates = ["scene-07-categories"];
        routeCandidates = ["/shop", "/shop/categories/fashion"];
        altText = "Contemporary South African street fashion and apparel";
      } else if (filename.includes("jhb-maboneng-vehicle-workshop")) {
        id = "operations.maboneng.workshop";
        semanticRole = "route-environment";
        sceneCandidates = ["scene-08-preparation", "scene-12-network"];
        routeCandidates = ["/about", "/careers"];
        altText = "Fleet dispatch and vehicle preparation workshop in Maboneng, Johannesburg";
      } else if (filename.includes("cape-town-road-night") || filename.includes("jhb-urban-aerial")) {
        id = `route.corridor.${filename.replace('.webp', '')}`;
        semanticRole = "route-environment";
        sceneCandidates = ["scene-11-route-tracking"];
        routeCandidates = ["/", "/coverage-areas"];
        altText = "South African metropolitan transit corridor at night";
      } else {
        id = `market.local.${filename.replace(/\.[^.]+$/, '')}`;
        semanticRole = "merchant-window";
        approvedForRuntime = true;
        altText = `South African local market documentary photography ${filename}`;
      }
    }
    // Auth assets
    else if (filename.startsWith("kt-auth-")) {
      semanticRole = "quiet-utility";
      approvedForRuntime = true;
      visualPriority = 2;
      routeCandidates = ["/login", "/signup", "/forgot-password", "/verify-otp"];
      altText = "KT Couriers secure authentication and partner access";
      id = `auth.${filename.replace('.webp', '')}`;
    }
    // Documentary series
    else if (filename.startsWith("r2-doc-")) {
      semanticRole = "preparation-detail";
      approvedForRuntime = true;
      visualPriority = 2;
      sceneCandidates = ["scene-08-preparation", "scene-10-handoff", "scene-13-arrival"];
      routeCandidates = ["/", "/about", "/safety"];
      altText = "Physical custody transfer and parcel verification documentation";
      id = `documentary.${filename.replace('.webp', '')}`;
    }
    // Unsplash food, wellness, fashion, homeware, routes
    else if (filename.includes("pelzer") || filename.includes("allison-saeng")) {
      id = "commerce.groceries.fresh-produce";
      semanticRole = "category-hero";
      approvedForRuntime = true;
      visualPriority = 2;
      routeCandidates = ["/shop/categories/groceries"];
      altText = "Organic crisp green produce for local grocery delivery";
    } else if (filename.includes("karolina-grabowska") || filename.includes("ela-de-pure") || filename.includes("declan-sun")) {
      id = `commerce.wellness.${filename.replace(/\.[^.]+$/, '')}`;
      semanticRole = "category-hero";
      approvedForRuntime = true;
      visualPriority = 2;
      routeCandidates = ["/shop/categories/health-wellness"];
      altText = "Amber glass natural skincare and botanical wellness items";
    } else if (filename.includes("blauth") || filename.includes("vitaly-gariev")) {
      id = `commerce.homeware.${filename.replace(/\.[^.]+$/, '')}`;
      semanticRole = "category-hero";
      approvedForRuntime = true;
      visualPriority = 2;
      routeCandidates = ["/shop/categories/home-living"];
      altText = "Curated natural ceramics and architectural homeware";
    } else if (filename.includes("vije-vijendranath") || filename.includes("chuttersnap") || filename.includes("mavic")) {
      id = `route.aerial.${filename.replace(/\.[^.]+$/, '')}`;
      semanticRole = "route-environment";
      approvedForRuntime = true;
      visualPriority = 2;
      sceneCandidates = ["scene-11-route-tracking"];
      routeCandidates = ["/", "/coverage-areas", "/about"];
      altText = "High-speed logistics highway corridor across Gauteng";
    } else {
      // General high-res Unsplash repository (available if specifically needed, but default unapproved to avoid bloat)
      id = `library.archive.${filename.replace(/\.[^.]+$/, '').replace(/[^a-z0-9_-]+/gi, '-').toLowerCase()}`;
      semanticRole = "quiet-utility";
      approvedForRuntime = false; // Design gate: only approved assets enter runtime
      visualPriority = 4;
      altText = "Archived library photographic reference";
    }
  }

  return {
    id,
    filename,
    sourcePath: `public/media/public/images/${relPath}`,
    runtimePaths: {},
    width,
    height,
    aspectRatio,
    hasAlpha,
    bytes: meta.size || 0,
    orientation,
    semanticRole,
    sceneCandidates,
    routeCandidates,
    focalPoint,
    desktopCrop,
    mobileCrop,
    textSafeRegion,
    transitionSuitability,
    parallaxSuitability,
    maskSuitability,
    colorCharacter,
    visualPriority,
    sourceMaster: `public/media/public/images/${relPath}`,
    duplicateGroup,
    approvedForRuntime,
    altText,
    md5: hash,
  };
}

async function main() {
  console.log("=== PHASE A: MEDIA INVENTORY & VISUAL SEMANTIC CLASSIFICATION ===");
  await mkdir(artifactsMediaDir, { recursive: true });

  const files = await scanFiles(mediaImagesDir, mediaImagesDir);
  console.log(`Found ${files.length} total raw media files under public/media/public/images.`);

  const inventory = [];
  const hashGroups = new Map();

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    try {
      const isSvg = /\.svg$/i.test(file.filename);
      let meta = {};
      let hash = "";

      if (isSvg) {
        const s = await stat(file.fullPath);
        meta = { width: 800, height: 800, hasAlpha: true, size: s.size };
        hash = crypto.createHash("md5").update(file.filename).digest("hex");
      } else {
        const s = await stat(file.fullPath);
        const imageMeta = await sharp(file.fullPath).metadata();
        meta = { ...imageMeta, size: s.size };
        hash = await hashFile(file.fullPath);
      }

      // Track duplicate hashes
      if (hashGroups.has(hash)) {
        hashGroups.get(hash).push(file.relPath);
      } else {
        hashGroups.set(hash, [file.relPath]);
      }

      const record = classifyAsset(file.relPath, file.filename, meta, hash);
      inventory.push(record);
    } catch (err) {
      console.error(`Error inspecting ${file.relPath}:`, err.message);
    }
  }

  // Detect duplicate groups
  for (const [hash, group] of hashGroups.entries()) {
    if (group.length > 1) {
      console.log(`Detected duplicate hash group (${group.length} files):`, group);
      for (const relPath of group) {
        const item = inventory.find((x) => x.sourcePath.endsWith(relPath));
        if (item) {
          item.duplicateGroup = `hash-${hash.slice(0, 8)}`;
        }
      }
    }
  }

  const approvedCount = inventory.filter((x) => x.approvedForRuntime).length;
  console.log(`Classified ${inventory.length} assets.`);
  console.log(`Approved for runtime: ${approvedCount} assets.`);
  console.log(`Archived / unapproved (kept safe locally, not emitted to runtime): ${inventory.length - approvedCount} assets.`);

  const outputPath = path.join(artifactsMediaDir, "media-inventory.json");
  await writeFile(outputPath, JSON.stringify(inventory, null, 2), "utf8");
  console.log(`Saved authoritative media inventory to: ${outputPath}`);
}

main().catch((err) => {
  console.error("Failed to run media inventory:", err);
  process.exit(1);
});
