import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const inventoryPath = path.join(rootDir, "artifacts", "media", "media-inventory.json");
const registryOutputPath = path.join(rootDir, "components", "public-v2", "media", "kt-media-registry.ts");

async function main() {
  console.log("=== PHASE B: GENERATING TYPED KT MEDIA REGISTRY ===");

  const inventoryRaw = await readFile(inventoryPath, "utf8");
  const inventory = JSON.parse(inventoryRaw);

  const approved = inventory.filter((item) => item.approvedForRuntime);
  console.log(`Building registry from ${approved.length} approved assets.`);

  const assetMap = new Map();
  const lowerMap = new Map();
  for (const item of approved) {
    assetMap.set(item.id, item);
    lowerMap.set(item.id.toLowerCase(), item);
  }

  // Helper to format an asset record for code generation
  function toCode(id, fallbackPath = "/media/public/derived/placeholder.webp") {
    const a = assetMap.get(id) || lowerMap.get(id.toLowerCase());
    if (!a) {
      console.warn(`[WARN] Asset not found for ID: ${id}`);
      return `{
    id: "${id}",
    src: "${fallbackPath}",
    alt: "KT Couriers media",
    width: 1440,
    height: 900,
    aspectRatio: 1.6,
    focalPoint: [0.5, 0.5],
    hasAlpha: false,
    desktopCrop: "optical-center",
    mobileCrop: "portrait-slice",
    textSafeRegion: "center-clear",
  }`;
    }

    const isProtagonist = a.semanticRole.startsWith("protagonist-");
    const isSvg = a.semanticRole === "illustration-vector";

    let primarySrc = a.runtimePaths.primary || a.runtimePaths.webp || a.runtimePaths.vector || `/media/public/images/${a.filename}`;
    let webpSrc = a.runtimePaths.webp || undefined;
    let pngSrc = a.runtimePaths.masterPng || undefined;

    // Generate responsive srcSet if widths are present
    const srcSetEntries = [];
    for (const [key, val] of Object.entries(a.runtimePaths)) {
      if (/^w\d+$/.test(key)) {
        const w = key.slice(1);
        srcSetEntries.push(`${val} ${w}w`);
      }
    }
    const srcSet = srcSetEntries.length > 0 ? srcSetEntries.join(", ") : undefined;

    return `{
    id: "${a.id}",
    src: "${primarySrc}",
    alt: ${JSON.stringify(a.altText)},
    width: ${a.width},
    height: ${a.height},
    aspectRatio: ${a.aspectRatio},
    focalPoint: [${a.focalPoint[0]}, ${a.focalPoint[1]}],
    hasAlpha: ${a.hasAlpha},
    ${webpSrc ? `webpSrc: "${webpSrc}",` : ""}
    ${pngSrc ? `pngSrc: "${pngSrc}",` : ""}
    ${srcSet ? `srcSet: "${srcSet}",` : ""}
    desktopCrop: "${a.desktopCrop}",
    mobileCrop: "${a.mobileCrop}",
    textSafeRegion: "${a.textSafeRegion}",
  }`;
  }

  // Courier poses array
  const courierPoses = approved
    .filter((a) => a.semanticRole === "protagonist-human")
    .map((a) => toCode(a.id));

  const content = `/**
 * KT COURIERS — AUTHORITATIVE TYPED MEDIA REGISTRY
 *
 * Generated from Phase A/B media inventory & Sharp WebP derivation.
 * All route components and scenes import media exclusively through this registry.
 * No hardcoded filenames or random paths allowed in visual components.
 */

export interface KTMediaAsset {
  id: string;
  src: string;
  alt: string;
  width: number;
  height: number;
  aspectRatio: number;
  focalPoint: readonly [number, number] | [number, number];
  hasAlpha: boolean;
  webpSrc?: string;
  pngSrc?: string;
  srcSet?: string;
  desktopCrop: "full-bleed" | "optical-center" | "baseline-ground" | "side-anchored";
  mobileCrop: "portrait-slice" | "cab-focus" | "courier-upper" | "horizontal-crawl";
  textSafeRegion: "top-left" | "top-right" | "bottom-left" | "bottom-right" | "center-clear";
}

export const ktMedia = {
  home: {
    heroTruck: {
      sideRight: ${toCode("protagonist.truck.white.side-right")},
      sideLeft: ${toCode("protagonist.truck.white.side-left")},
      centeredHero: ${toCode("protagonist.truck.white.centered-hero")},
      front3qRight: ${toCode("protagonist.truck.white.front-3q-right")},
      front3qLeft: ${toCode("protagonist.truck.white.front-3q-left")},
      topDownStraight: ${toCode("protagonist.truck.white.top-down-straight")},
      topDownTurning: ${toCode("protagonist.truck.white.top-down-turning")},
      cargoBoxMaterial: ${toCode("protagonist.truck.white.cargo-box-material")},
      cabCrop: ${toCode("protagonist.truck.white.close-crop-front-cab-only")},
      rearDoorsOpen: ${toCode("protagonist.truck.white.rear-doors-slightly-open")},
    },
    van: {
      sideRight: ${toCode("protagonist.van.side-right")},
      slidingDoorOpen: ${toCode("protagonist.van.sliding-door-open")},
      rearDoorsOpen: ${toCode("protagonist.van.rear-doors-open")},
      allDoorsOpen: ${toCode("protagonist.van.all-doors-open")},
      centeredHero: ${toCode("protagonist.van.centered-hero")},
      front3qRight: ${toCode("protagonist.van.front-three-quarter-facing-right")},
    },
    redTruck: {
      sideRight: ${toCode("protagonist.truck.red.side-right")},
      centeredHero: ${toCode("protagonist.truck.red.centered-hero")},
      curtainOpen: ${toCode("protagonist.truck.red.curtain-open")},
      front3qRight: ${toCode("protagonist.truck.red.front-three-quarter-view-facing-right")},
    },
    courier: {
      heroStanding: ${toCode("protagonist.courier.hero-standing")},
      carryOne: ${toCode("protagonist.courier.carry-one-parcel")},
      walkRightCarryOne: ${toCode("protagonist.courier.walk-right-one-parcel")},
      readyHandover: ${toCode("protagonist.courier.ready-handover")},
      extendingHandoff: ${toCode("protagonist.courier.extending-handoff")},
      approachVehicle: ${toCode("protagonist.courier.approach-vehicle")},
      loadingUnloading: ${toCode("protagonist.courier.loading-unloading")},
      allPoses: [
        ${courierPoses.join(",\n        ")}
      ] as readonly KTMediaAsset[],
    },
  },

  categories: {
    fashion: {
      hero: ${toCode("market.craft.leather-bags")},
      streetLook1: ${toCode("market.fashion.jhb-fashion-brown-coat")},
      streetLook2: ${toCode("market.fashion.jhb-fashion-white-top")},
      urbanGraffiti: ${toCode("market.local.jhb-fashion-graffiti")},
    },
    groceries: {
      hero: ${toCode("market.produce.fresh-crates")},
      freshGreens: ${toCode("commerce.groceries.fresh-produce")},
    },
    foodDining: {
      hero: ${toCode("market.food.prepared-bowl")},
    },
    homeLiving: {
      hero: ${toCode("market.craft.ceramics")},
      interiorVessel: ${toCode("commerce.homeware.vitaly-gariev-1jnn9qhmtgu-unsplash")},
    },
    healthWellness: {
      hero: ${toCode("commerce.wellness.declan-sun-7tc4dllcxf0-unsplash")},
      apothecaryJars: ${toCode("commerce.wellness.karolina-grabowska-aerjba-rnz4-unsplash")},
      essentialOils: ${toCode("commerce.wellness.ela-de-pure-dfubjaplwfi-unsplash")},
    },
  },

  routes: {
    nightTransitCorridor: ${toCode("route.aerial.vije-vijendranath-HBUNTeUfLFo-unsplash")},
    aerialHighway: ${toCode("route.aerial.mavic-101-LhgEKILDWTg-unsplash")},
    gautengTransitLine: ${toCode("route.aerial.vije-vijendranath-9o5zeS6QbgM-unsplash")},
    johannesburgCorridor: ${toCode("route.aerial.chuttersnap-xewrfLD8emE-unsplash")},
    mabonengWorkshop: ${toCode("route.aerial.vije-vijendranath-PgSm_blvwLo-unsplash")},
  },

  documentary: {
    driverArrival: ${toCode("documentary.r2-doc-02-driver-arrival")},
    pickup: ${toCode("documentary.r2-doc-03-pickup")},
    trackingCheck: ${toCode("documentary.r2-doc-05-tracking")},
    handoffDetail: ${toCode("documentary.r2-doc-06-handoff")},
  },

  auth: {
    customer: ${toCode("auth.kt-auth-01-customer")},
    merchant: ${toCode("auth.kt-auth-02-merchant")},
    product: ${toCode("auth.kt-auth-03-product")},
    recovery: ${toCode("auth.kt-auth-04-recovery")},
  },

  illustrations: {
    orderDelivery: ${toCode("illustration.order-delivery")},
    packageDelivery: ${toCode("illustration.package-delivery")},
    gpsLocation: ${toCode("illustration.gps-location")},
    onlineShopping: ${toCode("illustration.kt-ill-online-shopping")},
    motionOrderState: ${toCode("illustration.kt-motion-order-state")},
  },
} as const;

/**
 * Route-level and Scene-level Media Manifests.
 * Ensures routes only load and prewarm the assets they actually need.
 */
export const sceneManifests = {
  homepage: {
    scene00_02_hero: [
      ktMedia.home.heroTruck.sideRight,
      ktMedia.home.heroTruck.centeredHero,
    ],
    scene05_07_marketplace: [
      ktMedia.home.heroTruck.cargoBoxMaterial,
      ktMedia.categories.fashion.hero,
      ktMedia.categories.groceries.hero,
      ktMedia.categories.foodDining.hero,
      ktMedia.categories.homeLiving.hero,
      ktMedia.categories.healthWellness.hero,
    ],
    scene08_10_handoff: [
      ktMedia.documentary.pickup,
      ktMedia.home.van.slidingDoorOpen,
      ktMedia.home.courier.carryOne,
      ktMedia.home.courier.readyHandover,
      ktMedia.documentary.handoffDetail,
    ],
    scene11_12_route: [
      ktMedia.home.heroTruck.topDownStraight,
      ktMedia.home.heroTruck.topDownTurning,
      ktMedia.routes.aerialHighway,
      ktMedia.home.redTruck.sideRight,
    ],
    scene13_14_arrival: [
      ktMedia.home.courier.extendingHandoff,
      ktMedia.home.courier.heroStanding,
    ],
  },
  shop: {
    threshold: [ktMedia.categories.fashion.hero],
    categories: [
      ktMedia.categories.fashion.hero,
      ktMedia.categories.groceries.hero,
      ktMedia.categories.foodDining.hero,
      ktMedia.categories.healthWellness.hero,
      ktMedia.categories.homeLiving.hero,
    ],
  },
} as const;

/**
 * Helper to generate responsive img srcSet string
 */
export function getMediaSrcSet(asset: KTMediaAsset): string | undefined {
  return asset.srcSet;
}

/**
 * Identifies the single authoritative first-viewport LCP asset for a given route.
 */
export function getRouteLcpAsset(pathname: string): KTMediaAsset | null {
  if (pathname === "/") return ktMedia.home.heroTruck.sideRight;
  if (pathname.startsWith("/shop/categories")) return ktMedia.categories.fashion.hero;
  if (pathname.startsWith("/shop")) return ktMedia.categories.fashion.hero;
  if (pathname.startsWith("/services/freight")) return ktMedia.home.redTruck.sideRight;
  if (pathname.startsWith("/services/parcel")) return ktMedia.home.courier.heroStanding;
  if (pathname.startsWith("/services/grocery") || pathname.startsWith("/services/food")) return ktMedia.home.van.sideRight;
  if (pathname.startsWith("/about")) return ktMedia.routes.mabonengWorkshop;
  if (pathname.startsWith("/login") || pathname.startsWith("/signup")) return ktMedia.auth.customer;
  return null;
}
`;

  await mkdir(path.dirname(registryOutputPath), { recursive: true });
  await writeFile(registryOutputPath, content, "utf8");
  console.log(`Authoritative media registry successfully generated at: ${registryOutputPath}`);
}

main().catch((err) => {
  console.error("Failed to generate media registry:", err);
  process.exit(1);
});
