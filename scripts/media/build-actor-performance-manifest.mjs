import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const rootDir = process.cwd();
const imagesDir = path.join(rootDir, "public", "media", "public", "images");
const protagonistsWebpDir = path.join(rootDir, "public", "media", "public", "protagonists");
const artifactsMediaDir = path.join(rootDir, "artifacts", "media");
const generatedDir = path.join(rootDir, "components", "public-v3", "actors");

const PACKS = [
  {
    packName: "white_truck_asset_pack_16_images",
    actorType: "white-truck",
  },
  {
    packName: "KT_Courier_Van_Asset_Pack_14_PNGs",
    actorType: "van",
  },
  {
    packName: "KT_Courier_20_Transparent_PNG_Assets",
    actorType: "courier",
  },
  {
    packName: "truck_asset_pack_12_images",
    actorType: "red-truck",
  },
];

// Map filename patterns to canonical state IDs and semantic taxonomy
function getSemanticInfo(actorType, filename) {
  const f = filename.toLowerCase();
  
  if (actorType === "white-truck") {
    if (f.includes("01_full_side_view_facing_right")) return { id: "side-right", direction: "right", action: "travel", family: "hero" };
    if (f.includes("02_full_side_view_facing_left")) return { id: "side-left", direction: "left", action: "travel", family: "network" };
    if (f.includes("03_centered_hero_side_view")) return { id: "centered-hero", direction: "right", action: "idle", family: "hero" };
    if (f.includes("04_front_three_quarter_view_facing_right")) return { id: "front-3q-right", direction: "right", action: "approach", family: "road" };
    if (f.includes("05_front_three_quarter_view_facing_left")) return { id: "front-3q-left", direction: "left", action: "approach", family: "road" };
    if (f.includes("06_rear_three_quarter_view_facing_right")) return { id: "rear-3q-right", direction: "right", action: "depart", family: "road" };
    if (f.includes("07_rear_three_quarter_view_facing_left")) return { id: "rear-3q-left", direction: "left", action: "depart", family: "road" };
    if (f.includes("08_top_down_view")) return { id: "top-down-straight", direction: "top-down", action: "travel", family: "route" };
    if (f.includes("09_top_down_angled_straight_road")) return { id: "top-down-angled", direction: "top-down", action: "approach", family: "route" };
    if (f.includes("10_oversized_wide_hero_composition")) return { id: "wide-hero", direction: "right", action: "travel", family: "hero" };
    if (f.includes("11_close_crop_front_cab_only")) return { id: "front-cab-close", direction: "right", action: "travel", family: "detail" };
    if (f.includes("12_close_crop_long_cargo_box_only")) return { id: "cargo-box-close", direction: "right", action: "travel", family: "detail" };
    if (f.includes("13_close_crop_rear_portion_only")) return { id: "rear-portion-close", direction: "right", action: "travel", family: "detail" };
    if (f.includes("14_rear_doors_slightly_open")) return { id: "rear-doors-open", direction: "rear", action: "open", family: "detail" };
    if (f.includes("15_subtle_motion_energy")) return { id: "motion-energy", direction: "right", action: "accelerate", family: "hero" };
    if (f.includes("16_top_down_turning_curve_transition")) return { id: "top-down-turning", direction: "turning", action: "turn", family: "route" };
  }

  if (actorType === "van") {
    if (f.includes("01_full_side_view_facing_right")) return { id: "side-right", direction: "right", action: "travel", family: "street-right" };
    if (f.includes("02_full_side_view_facing_left")) return { id: "side-left", direction: "left", action: "travel", family: "collection" };
    if (f.includes("03_front_three_quarter_facing_right")) return { id: "front-3q-right", direction: "right", action: "approach", family: "street-right" };
    if (f.includes("04_front_three_quarter_facing_left")) return { id: "front-3q-left", direction: "left", action: "approach", family: "collection" };
    if (f.includes("05_rear_three_quarter_facing_right")) return { id: "rear-3q-right", direction: "right", action: "depart", family: "street-right" };
    if (f.includes("06_rear_three_quarter_facing_left")) return { id: "rear-3q-left", direction: "left", action: "depart", family: "street-left" };
    if (f.includes("07_centered_hero_version")) return { id: "centered-hero", direction: "left", action: "idle", family: "street-left" };
    if (f.includes("08_close_crop_front_half")) return { id: "front-half-close", direction: "detail", action: "idle", family: "detail" };
    if (f.includes("09_close_crop_rear_half")) return { id: "rear-half-close", direction: "detail", action: "idle", family: "detail" };
    if (f.includes("10_side_sliding_door_open")) return { id: "sliding-door-open", direction: "left", action: "open", family: "collection" };
    if (f.includes("11_rear_doors_open")) return { id: "rear-doors-open", direction: "rear", action: "open", family: "loading" };
    if (f.includes("12_side_and_rear_doors_open")) return { id: "all-doors-open", direction: "rear", action: "open", family: "loading" };
    if (f.includes("13_slight_motion_web_transition")) return { id: "motion-transition", direction: "left", action: "approach", family: "collection" };
    if (f.includes("14_service_card_category_version")) return { id: "service-card", direction: "right", action: "idle", family: "service" };
  }

  if (actorType === "courier") {
    if (f.includes("01_original_pose_refined")) return { id: "hero-standing", direction: "front", action: "idle", family: "portrait" };
    if (f.includes("02_full_body_one_parcel")) return { id: "full-body-one-parcel", direction: "front", action: "carry", family: "portrait" };
    if (f.includes("03_full_body_two_parcels")) return { id: "full-body-two-parcels", direction: "front", action: "carry", family: "portrait" };
    if (f.includes("04_walking_one_parcel_facing_right")) return { id: "walk-right-one-parcel", direction: "right", action: "travel", family: "street" };
    if (f.includes("05_walking_one_parcel_facing_left")) return { id: "walk-left-one-parcel", direction: "left", action: "travel", family: "arrival" };
    if (f.includes("06_walking_two_parcels")) return { id: "walk-two-parcels", direction: "right", action: "travel", family: "street" };
    if (f.includes("07_ready_to_handover_parcel")) return { id: "ready-handover", direction: "left", action: "handoff", family: "custody" };
    if (f.includes("08_extending_parcel_for_handoff")) return { id: "extending-handoff", direction: "left", action: "handoff", family: "arrival" };
    if (f.includes("09_looking_toward_viewer_with_parcel")) return { id: "look-viewer-parcel", direction: "front", action: "idle", family: "portrait" };
    if (f.includes("10_looking_right_approaching_vehicle")) return { id: "look-right-approach", direction: "right", action: "approach", family: "vehicle" };
    if (f.includes("11_looking_left_approaching_vehicle")) return { id: "look-left-approach", direction: "left", action: "approach", family: "collection" };
    if (f.includes("12_placing_parcel_down")) return { id: "place-parcel", direction: "front", action: "load", family: "loading" };
    if (f.includes("13_lifting_parcel_up")) return { id: "lift-parcel", direction: "left", action: "load", family: "collection" };
    if (f.includes("14_small_parcel_one_hand")) return { id: "small-parcel-one-hand", direction: "front", action: "carry", family: "portrait" };
    if (f.includes("15_medium_box_under_arm")) return { id: "medium-box-arm", direction: "front", action: "carry", family: "portrait" };
    if (f.includes("16_empty_hands_courier_hero")) return { id: "empty-hands-hero", direction: "front", action: "idle", family: "portrait" };
    if (f.includes("17_forward_gesture_with_parcel")) return { id: "forward-gesture", direction: "front", action: "handoff", family: "arrival" };
    if (f.includes("18_loading_unloading_parcel")) return { id: "loading-unloading", direction: "left", action: "load", family: "collection" };
    if (f.includes("19_half_body_holding_parcel")) return { id: "half-body-holding", direction: "front", action: "carry", family: "portrait" };
    if (f.includes("20_close_crop_upper_body_portrait")) return { id: "portrait-upper-body", direction: "detail", action: "idle", family: "detail" };
  }

  if (actorType === "red-truck") {
    if (f.includes("01_full_side_view_facing_right")) return { id: "side-right", direction: "right", action: "travel", family: "freight" };
    if (f.includes("02_full_side_view_facing_left")) return { id: "side-left", direction: "left", action: "travel", family: "freight-left" };
    if (f.includes("03_front_three_quarter_view_facing_right")) return { id: "front-3q-right", direction: "right", action: "approach", family: "road" };
    if (f.includes("04_front_three_quarter_view_facing_left")) return { id: "front-3q-left", direction: "left", action: "approach", family: "road" };
    if (f.includes("05_rear_three_quarter_view_facing_right")) return { id: "rear-3q-right", direction: "right", action: "depart", family: "road" };
    if (f.includes("06_rear_three_quarter_view_facing_left")) return { id: "rear-3q-left", direction: "left", action: "depart", family: "road" };
    if (f.includes("07_centered_hero_version")) return { id: "centered-hero", direction: "center", action: "idle", family: "freight" };
    if (f.includes("08_front_cab_close_crop")) return { id: "cab-crop", direction: "detail", action: "travel", family: "detail" };
    if (f.includes("09_trailer_middle_section_close_crop")) return { id: "trailer-middle-crop", direction: "detail", action: "travel", family: "detail" };
    if (f.includes("10_rear_trailer_section_close_crop")) return { id: "rear-trailer-crop", direction: "detail", action: "travel", family: "detail" };
    if (f.includes("11_motion_version")) return { id: "motion-entry", direction: "right", action: "accelerate", family: "freight" };
    if (f.includes("12_curtain_open")) return { id: "curtain-open", direction: "right", action: "open", family: "freight" };
  }

  return { id: f.replace(/\.[^.]+$/, ""), direction: "center", action: "idle", family: "default" };
}

// Find WebP runtime asset matching state
async function findWebpPath(stateId, actorType) {
  // Read protagonist webp files
  const webpFiles = await readdir(protagonistsWebpDir);
  const match = webpFiles.find(name => {
    const n = name.toLowerCase();
    if (actorType === "white-truck" && n.includes("white")) {
      if (stateId === "side-right" && n.includes("side-right")) return true;
      if (stateId === "side-left" && n.includes("side-left")) return true;
      if (stateId === "centered-hero" && n.includes("centered-hero")) return true;
      if (stateId === "front-3q-right" && n.includes("front-3q-right")) return true;
      if (stateId === "front-3q-left" && n.includes("front-3q-left")) return true;
      if (stateId === "rear-3q-right" && n.includes("rear-three-quarter-view-facing-right")) return true;
      if (stateId === "rear-3q-left" && n.includes("rear-three-quarter-view-facing-left")) return true;
      if (stateId === "top-down-straight" && n.includes("top-down-straight")) return true;
      if (stateId === "top-down-angled" && n.includes("top-down-angled")) return true;
      if (stateId === "wide-hero" && n.includes("oversized-wide-hero")) return true;
      if (stateId === "front-cab-close" && n.includes("front-cab")) return true;
      if (stateId === "cargo-box-close" && n.includes("cargo-box")) return true;
      if (stateId === "rear-portion-close" && n.includes("rear-portion")) return true;
      if (stateId === "rear-doors-open" && n.includes("rear-doors")) return true;
      if (stateId === "motion-energy" && n.includes("motion-energy")) return true;
      if (stateId === "top-down-turning" && n.includes("top-down-turning")) return true;
    }
    if (actorType === "van" && n.includes("van")) {
      if (stateId === "side-right" && n.includes("side-right")) return true;
      if (stateId === "side-left" && n.includes("side-view-facing-left")) return true;
      if (stateId === "front-3q-right" && n.includes("front-three-quarter-facing-right")) return true;
      if (stateId === "front-3q-left" && n.includes("front-three-quarter-facing-left")) return true;
      if (stateId === "rear-3q-right" && n.includes("rear-three-quarter-facing-right")) return true;
      if (stateId === "rear-3q-left" && n.includes("rear-three-quarter-facing-left")) return true;
      if (stateId === "centered-hero" && n.includes("centered-hero")) return true;
      if (stateId === "front-half-close" && n.includes("front-half")) return true;
      if (stateId === "rear-half-close" && n.includes("rear-half")) return true;
      if (stateId === "sliding-door-open" && n.includes("sliding-door-open")) return true;
      if (stateId === "rear-doors-open" && n.includes("rear-doors-open")) return true;
      if (stateId === "all-doors-open" && n.includes("all-doors-open")) return true;
      if (stateId === "motion-transition" && n.includes("slight-motion-web-transition")) return true;
      if (stateId === "service-card" && n.includes("service-card")) return true;
    }
    if (actorType === "courier" && n.includes("courier")) {
      if (stateId === "hero-standing" && n.includes("hero-standing")) return true;
      if (stateId === "full-body-one-parcel" && n.includes("carry-one-parcel")) return true;
      if (stateId === "full-body-two-parcels" && n.includes("full-body-two-parcels")) return true;
      if (stateId === "walk-right-one-parcel" && n.includes("walk-right-one-parcel")) return true;
      if (stateId === "walk-left-one-parcel" && n.includes("walking-one-parcel-facing-left")) return true;
      if (stateId === "walk-two-parcels" && n.includes("walking-two-parcels")) return true;
      if (stateId === "ready-handover" && n.includes("ready-handover")) return true;
      if (stateId === "extending-handoff" && n.includes("extending-handoff")) return true;
      if (stateId === "look-viewer-parcel" && n.includes("looking-toward-viewer")) return true;
      if (stateId === "look-right-approach" && n.includes("approach-vehicle")) return true;
      if (stateId === "look-left-approach" && n.includes("looking-left-approaching-vehicle")) return true;
      if (stateId === "place-parcel" && n.includes("placing-parcel-down")) return true;
      if (stateId === "lift-parcel" && n.includes("lifting-parcel-up")) return true;
      if (stateId === "small-parcel-one-hand" && n.includes("small-parcel-one-hand")) return true;
      if (stateId === "medium-box-arm" && n.includes("medium-box-under-arm")) return true;
      if (stateId === "empty-hands-hero" && n.includes("empty-hands-courier-hero")) return true;
      if (stateId === "forward-gesture" && n.includes("forward-gesture")) return true;
      if (stateId === "loading-unloading" && n.includes("loading-unloading")) return true;
      if (stateId === "half-body-holding" && n.includes("half-body-holding")) return true;
      if (stateId === "portrait-upper-body" && n.includes("close-crop-upper-body-portrait")) return true;
    }
    if (actorType === "red-truck" && n.includes("red")) {
      if (stateId === "side-right" && n.includes("side-right")) return true;
      if (stateId === "side-left" && n.includes("side-view-facing-left")) return true;
      if (stateId === "front-3q-right" && n.includes("front-three-quarter-view-facing-right")) return true;
      if (stateId === "front-3q-left" && n.includes("front-three-quarter-view-facing-left")) return true;
      if (stateId === "rear-3q-right" && n.includes("rear-three-quarter-view-facing-right")) return true;
      if (stateId === "rear-3q-left" && n.includes("rear-three-quarter-view-facing-left")) return true;
      if (stateId === "centered-hero" && n.includes("centered-hero")) return true;
      if (stateId === "cab-crop" && n.includes("front-cab-close-crop")) return true;
      if (stateId === "trailer-middle-crop" && n.includes("trailer-middle-section")) return true;
      if (stateId === "rear-trailer-crop" && n.includes("rear-trailer-section")) return true;
      if (stateId === "motion-entry" && n.includes("motion-version")) return true;
      if (stateId === "curtain-open" && n.includes("curtain-open")) return true;
    }
    return false;
  });

  return match ? `/media/public/protagonists/${match}` : `/media/public/protagonists/unknown.webp`;
}

// Compute ground contact baseline using alpha analysis
async function computeGroundContact(filePath, width, height) {
  const { data, info } = await sharp(filePath)
    .raw()
    .toBuffer({ resolveWithObject: true });

  const channels = info.channels;
  let lowestY = 0;
  let lowestXSum = 0;
  let lowestCount = 0;

  // Scan rows from bottom up to find lowest opaque contact pixels
  for (let y = height - 1; y >= 0; y--) {
    let rowOpaqueCount = 0;
    let rowXSum = 0;
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * channels;
      const alpha = channels === 4 ? data[idx + 3] : 255;
      if (alpha > 40) {
        rowOpaqueCount++;
        rowXSum += x;
      }
    }
    // If row has significant contact pixels (more than 5 pixels)
    if (rowOpaqueCount >= 5 && lowestY === 0) {
      lowestY = y;
      lowestXSum = rowXSum;
      lowestCount = rowOpaqueCount;
      break;
    }
  }

  const contactY = lowestY > 0 ? Number((lowestY / height).toFixed(4)) : 1.0;
  const contactX = lowestCount > 0 ? Number((lowestXSum / lowestCount / width).toFixed(4)) : 0.5;

  return { x: contactX, y: contactY };
}

// Perform exact pixel difference analysis between closed-left and door-open Van PNGs
async function computeVanDoorMask() {
  const closedLeftFile = path.join(imagesDir, "KT_Courier_Van_Asset_Pack_14_PNGs", "02_full_side_view_facing_left.png");
  const doorOpenFile = path.join(imagesDir, "KT_Courier_Van_Asset_Pack_14_PNGs", "10_side_sliding_door_open.png");

  console.log("Reading Van masters for pixel-difference door calibration...");
  console.log("Closed Left:", closedLeftFile);
  console.log("Door Open:", doorOpenFile);

  const [rawClosed, rawOpen] = await Promise.all([
    sharp(closedLeftFile).raw().toBuffer({ resolveWithObject: true }),
    sharp(doorOpenFile).raw().toBuffer({ resolveWithObject: true }),
  ]);

  if (rawClosed.info.width !== rawOpen.info.width || rawClosed.info.height !== rawOpen.info.height) {
    throw new Error(`Master dimension mismatch: closed (${rawClosed.info.width}x${rawClosed.info.height}) vs open (${rawOpen.info.width}x${rawOpen.info.height})`);
  }

  const width = rawClosed.info.width;
  const height = rawClosed.info.height;
  const channels = rawClosed.info.channels; // 4 for RGBA

  console.log(`Van master canvas confirmed: ${width}x${height} with ${channels} channels`);

  const bufClosed = rawClosed.data;
  const bufOpen = rawOpen.data;

  let minX = width;
  let maxX = 0;
  let minY = height;
  let maxY = 0;
  let changedPixelCount = 0;

  // Mask map for spatial filtering
  const diffMask = new Uint8Array(width * height);

  // Per-pixel RGBA delta calculation with noise threshold
  const THRESHOLD = 45; // Reject minor anti-aliasing / slight shading changes
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * channels;
      const rDiff = Math.abs(bufClosed[idx] - bufOpen[idx]);
      const gDiff = Math.abs(bufClosed[idx + 1] - bufOpen[idx + 1]);
      const bDiff = Math.abs(bufClosed[idx + 2] - bufOpen[idx + 2]);
      const aDiff = Math.abs(bufClosed[idx + 3] - bufOpen[idx + 3]);
      const totalDelta = (rDiff + gDiff + bDiff + aDiff) / 4;

      if (totalDelta > THRESHOLD) {
        // Only accept changes in the van cargo zone:
        // Van facing left: front cab is on the LEFT, cargo door is in middle-left to middle-right
        // Reject changes in lower wheels / undercarriage or extreme front bumper
        if (y > height * 0.15 && y < height * 0.85 && x > width * 0.20 && x < width * 0.75) {
          diffMask[y * width + x] = 1;
          changedPixelCount++;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
  }

  console.log(`Detected ${changedPixelCount} door-opening delta pixels in cargo region.`);
  console.log(`Raw door bounding box: x [${minX}, ${maxX}] y [${minY}, ${maxY}]`);

  // Add 1.5% safety padding around detected aperture
  const padX = Math.round(width * 0.015);
  const padY = Math.round(height * 0.015);

  const boundedMinX = Math.max(0, minX - padX);
  const boundedMaxX = Math.min(width, maxX + padX);
  const boundedMinY = Math.max(0, minY - padY);
  const boundedMaxY = Math.min(height, maxY + padY);

  const doorWidth = boundedMaxX - boundedMinX;
  const doorHeight = boundedMaxY - boundedMinY;

  const normalizedMask = {
    x: Number((boundedMinX / width).toFixed(4)),
    y: Number((boundedMinY / height).toFixed(4)),
    width: Number((doorWidth / width).toFixed(4)),
    height: Number((doorHeight / height).toFixed(4)),
  };

  console.log("Calibrated Normalized Door Mask:", normalizedMask);

  // Inset CSS representation for clip-path: inset(top right bottom left)
  const insetTop = (normalizedMask.y * 100).toFixed(2);
  const insetRight = ((1 - (normalizedMask.x + normalizedMask.width)) * 100).toFixed(2);
  const insetBottom = ((1 - (normalizedMask.y + normalizedMask.height)) * 100).toFixed(2);
  const insetLeft = (normalizedMask.x * 100).toFixed(2);

  const clipPathInset = `inset(${insetTop}% ${insetRight}% ${insetBottom}% ${insetLeft}%)`;
  console.log("Calculated clip-path:", clipPathInset);

  return {
    rawBounds: { minX: boundedMinX, maxX: boundedMaxX, minY: boundedMinY, maxY: boundedMaxY, width, height },
    normalizedMask,
    clipPathInset,
  };
}

async function main() {
  console.log("=== Phase 1: Building Authoritative Actor Performance Manifest ===");
  await mkdir(artifactsMediaDir, { recursive: true });
  await mkdir(path.join(artifactsMediaDir, "contact-sheets"), { recursive: true });

  const doorCalibration = await computeVanDoorMask();

  const auditManifest = {
    generatedAt: new Date().toISOString(),
    doorCalibration,
    actors: {},
  };

  const codeEntries = [];

  for (const pack of PACKS) {
    const packDir = path.join(imagesDir, pack.packName);
    const files = (await readdir(packDir)).filter(f => /\.(png|webp)$/i.test(f)).sort();

    console.log(`Processing pack: ${pack.packName} (${files.length} images)...`);

    for (const file of files) {
      const filePath = path.join(packDir, file);
      const meta = await sharp(filePath).metadata();
      const semantic = getSemanticInfo(pack.actorType, file);
      const webpSrc = await findWebpPath(semantic.id, pack.actorType);
      const groundContact = await computeGroundContact(filePath, meta.width, meta.height);

      const aspectRatio = Number((meta.width / meta.height).toFixed(4));

      const stateData = {
        id: semantic.id,
        actorType: pack.actorType,
        sourceFile: file,
        webpSrc,
        width: meta.width,
        height: meta.height,
        aspectRatio,
        format: meta.format,
        hasAlpha: Boolean(meta.hasAlpha),
        direction: semantic.direction,
        action: semantic.action,
        family: semantic.family,
        groundContact,
      };

      if (!auditManifest.actors[pack.actorType]) {
        auditManifest.actors[pack.actorType] = [];
      }
      auditManifest.actors[pack.actorType].push(stateData);

      codeEntries.push(stateData);
    }
  }

  // Write actor-performance-audit.json
  const auditPath = path.join(artifactsMediaDir, "actor-performance-audit.json");
  await writeFile(auditPath, JSON.stringify(auditManifest, null, 2), "utf8");
  console.log(`Wrote audit manifest to ${auditPath}`);

  // Generate TypeScript code
  const tsContent = `/**
 * AUTOGENERATED ACTOR PERFORMANCE METADATA
 * Generated by scripts/media/build-actor-performance-manifest.mjs
 * Authoritative source: Local raw PNG masters via sharp.metadata() & pixel difference analysis.
 * DO NOT EDIT MANUALLY.
 */

export interface GeneratedActorState {
  id: string;
  actorType: "white-truck" | "van" | "courier" | "red-truck";
  sourceFile: string;
  webpSrc: string;
  width: number;
  height: number;
  aspectRatio: number;
  hasAlpha: boolean;
  direction: "left" | "right" | "front" | "rear" | "top-down" | "turning" | "detail" | "center";
  action: "idle" | "approach" | "travel" | "accelerate" | "brake" | "open" | "load" | "handoff" | "turn" | "depart" | "carry";
  family: string;
  groundContact: {
    x: number;
    y: number;
  };
}

export const VAN_DOOR_CALIBRATION = {
  rawBounds: ${JSON.stringify(doorCalibration.rawBounds, null, 2)},
  normalizedMask: ${JSON.stringify(doorCalibration.normalizedMask, null, 2)},
  clipPathInset: "${doorCalibration.clipPathInset}",
} as const;

export const GENERATED_ACTOR_STATES: Record<string, GeneratedActorState> = {
${codeEntries
  .map(
    entry => `  "${entry.actorType}:${entry.id}": {
    id: "${entry.id}",
    actorType: "${entry.actorType}",
    sourceFile: "${entry.sourceFile}",
    webpSrc: "${entry.webpSrc}",
    width: ${entry.width},
    height: ${entry.height},
    aspectRatio: ${entry.aspectRatio},
    hasAlpha: ${entry.hasAlpha},
    direction: "${entry.direction}",
    action: "${entry.action}",
    family: "${entry.family}",
    groundContact: { x: ${entry.groundContact.x}, y: ${entry.groundContact.y} },
  },`
  )
  .join("\n")}
};
`;

  const tsPath = path.join(generatedDir, "generated-actor-media.ts");
  await writeFile(tsPath, tsContent, "utf8");
  console.log(`Wrote TypeScript definitions to ${tsPath}`);

  // Generate visual validation contact sheet HTML
  const contactSheetHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>KT Courier — Phase 1 Actor Performance Validation</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #14171A; color: #F1ECE2; padding: 2rem; margin: 0; }
    h1, h2 { color: #FFFFFF; }
    .section { margin-bottom: 3rem; background: #1F2428; padding: 1.5rem; border-radius: 8px; }
    .stage { display: flex; align-items: flex-end; gap: 2rem; background: #2B3137; padding: 2rem; position: relative; min-height: 400px; border-bottom: 4px solid #CF2930; }
    .ground-line { position: absolute; left: 0; right: 0; height: 2px; background: rgba(255,255,255,0.4); border-top: 1px dashed red; }
    .card { background: #14171A; border: 1px solid #333; padding: 1rem; border-radius: 4px; text-align: center; }
    .card img { max-width: 320px; height: auto; display: block; margin: 0 auto; }
    .door-demo { position: relative; width: 450px; }
    .door-demo img { width: 100%; display: block; }
    .door-aperture { position: absolute; border: 2px solid #CF2930; background: rgba(207, 41, 48, 0.2); pointer-events: none; }
    .meta { font-family: monospace; font-size: 0.8rem; color: #9E9E9E; margin-top: 0.5rem; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: bold; background: #CF2930; color: #FFF; margin-bottom: 4px; }
  </style>
</head>
<body>
  <h1>KT Courier — Phase 1 Actor Performance Validation Sheet</h1>
  <p>Authoritative dimensions, orientation families, door mask registration, and physical ground baselines.</p>

  <div class="section">
    <h2>1. Collection Coherent Sequence (Left-Facing Van + Left-Facing Courier)</h2>
    <p>Notice: Van enters left-facing (#13), stops (#02), and door opens (#10) on the cargo aperture. Courier approaches vehicle facing left (#11), lifts parcel (#13), stages into cargo space (#18).</p>
    <div class="stage">
      <div class="card">
        <span class="badge">Van #13</span>
        <div>motion-transition</div>
        <img src="/media/public/protagonists/protagonist-van-slight-motion-web-transition.webp" alt="Van 13">
        <div class="meta">Direction: LEFT | Ground Y: ${auditManifest.actors.van.find(a => a.id === "motion-transition")?.groundContact.y}</div>
      </div>
      <div class="card">
        <span class="badge">Van #02</span>
        <div>side-left (Closed)</div>
        <img src="/media/public/protagonists/protagonist-van-full-side-view-facing-left.webp" alt="Van 02">
        <div class="meta">Direction: LEFT | Ground Y: ${auditManifest.actors.van.find(a => a.id === "side-left")?.groundContact.y}</div>
      </div>
      <div class="card">
        <span class="badge">Van #10</span>
        <div>sliding-door-open</div>
        <img src="/media/public/protagonists/protagonist-van-sliding-door-open.webp" alt="Van 10">
        <div class="meta">Direction: LEFT | Ground Y: ${auditManifest.actors.van.find(a => a.id === "sliding-door-open")?.groundContact.y}</div>
      </div>
      <div class="card">
        <span class="badge">Courier #11</span>
        <div>look-left-approach</div>
        <img src="/media/public/protagonists/protagonist-courier-looking-left-approaching-vehicle.webp" alt="Courier 11">
        <div class="meta">Direction: LEFT | Ground Y: ${auditManifest.actors.courier.find(a => a.id === "look-left-approach")?.groundContact.y}</div>
      </div>
      <div class="card">
        <span class="badge">Courier #13</span>
        <div>lift-parcel</div>
        <img src="/media/public/protagonists/protagonist-courier-lifting-parcel-up.webp" alt="Courier 13">
        <div class="meta">Direction: LEFT | Ground Y: ${auditManifest.actors.courier.find(a => a.id === "lift-parcel")?.groundContact.y}</div>
      </div>
      <div class="card">
        <span class="badge">Courier #18</span>
        <div>loading-unloading</div>
        <img src="/media/public/protagonists/protagonist-courier-loading-unloading.webp" alt="Courier 18">
        <div class="meta">Direction: LEFT | Ground Y: ${auditManifest.actors.courier.find(a => a.id === "loading-unloading")?.groundContact.y}</div>
      </div>
    </div>
  </div>

  <div class="section">
    <h2>2. Calibrated Van Door Aperture Mask (Pixel Difference Derived)</h2>
    <p>Aperture derived from pixel delta between #02 closed-left and #10 door-open PNGs.</p>
    <div style="display: flex; gap: 2rem; align-items: center;">
      <div class="door-demo">
        <img src="/media/public/protagonists/protagonist-van-sliding-door-open.webp" alt="Door Aperture Demo">
        <div class="door-aperture" style="
          left: ${doorCalibration.normalizedMask.x * 100}%;
          top: ${doorCalibration.normalizedMask.y * 100}%;
          width: ${doorCalibration.normalizedMask.width * 100}%;
          height: ${doorCalibration.normalizedMask.height * 100}%;
        "></div>
      </div>
      <div>
        <pre class="meta" style="background:#111; padding:1rem; border-radius:4px;">
Normalized Mask:
x:      ${doorCalibration.normalizedMask.x}
y:      ${doorCalibration.normalizedMask.y}
width:  ${doorCalibration.normalizedMask.width}
height: ${doorCalibration.normalizedMask.height}

CSS clip-path:
clip-path: ${doorCalibration.clipPathInset};
        </pre>
      </div>
    </div>
  </div>

  <div class="section">
    <h2>3. White Truck Hero & Route Family Check</h2>
    <p>Hero: Dominant rightward profile. Route: 08 top-down straight -> 09 top-down angled -> 16 top-down turning.</p>
    <div style="display: flex; gap: 1rem; flex-wrap: wrap;">
      <div class="card"><span class="badge">Hero #10</span><img src="/media/public/protagonists/protagonist-truck-white-oversized-wide-hero-composition.webp" style="max-width:260px"><div class="meta">wide-hero (Right)</div></div>
      <div class="card"><span class="badge">Route #08</span><img src="/media/public/protagonists/protagonist-truck-white-top-down-straight.webp" style="max-width:260px"><div class="meta">top-down-straight</div></div>
      <div class="card"><span class="badge">Route #09</span><img src="/media/public/protagonists/protagonist-truck-white-top-down-angled-straight-road.webp" style="max-width:260px"><div class="meta">top-down-angled</div></div>
      <div class="card"><span class="badge">Route #16</span><img src="/media/public/protagonists/protagonist-truck-white-top-down-turning.webp" style="max-width:260px"><div class="meta">top-down-turning</div></div>
    </div>
  </div>
</body>
</html>
`;

  const sheetPath = path.join(artifactsMediaDir, "contact-sheets", "phase1-actor-validation.html");
  await writeFile(sheetPath, contactSheetHtml, "utf8");
  console.log(`Wrote contact sheet HTML to ${sheetPath}`);

  console.log("=== Phase 1 Manifest Generation Complete ===");
}

main().catch(err => {
  console.error("Manifest generation failed:", err);
  process.exit(1);
});
