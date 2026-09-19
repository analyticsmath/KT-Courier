import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const inventoryPath = path.join(rootDir, "artifacts", "media", "media-inventory.json");
const registryV2OutputPath = path.join(rootDir, "components", "public-v2", "media", "kt-media-registry.ts");
const registryV3OutputPath = path.join(rootDir, "components", "public-v3", "media", "kt-media-v3.ts");

async function main() {
  console.log("=== PHASE B: GENERATING TYPED KT MEDIA REGISTRIES (v2 & v3) ===");

  const inventoryRaw = await readFile(inventoryPath, "utf8");
  const inventory = JSON.parse(inventoryRaw);

  const approved = inventory.filter((item) => item.approvedForRuntime);
  console.log(`Building registries from ${approved.length} approved assets.`);

  const assetMap = new Map();
  const lowerMap = new Map();
  for (const item of approved) {
    assetMap.set(item.id, item);
    lowerMap.set(item.id.toLowerCase(), item);
    // Also index by filename
    assetMap.set(item.filename, item);
    lowerMap.set(item.filename.toLowerCase(), item);
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
    priority: 3,
    role: "quiet-utility",
  }`;
    }

    const primarySrc = a.runtimePaths?.primary || a.runtimePaths?.webp || a.runtimePaths?.vector || `/media/public/images/${a.filename}`;
    const webpSrc = a.runtimePaths?.webp || undefined;
    const pngSrc = a.runtimePaths?.masterPng || undefined;

    // Generate responsive srcSet if widths are present
    const srcSetEntries = [];
    if (a.runtimePaths) {
      for (const [key, val] of Object.entries(a.runtimePaths)) {
        if (/^w\d+$/.test(key)) {
          const w = key.slice(1);
          srcSetEntries.push(`${val} ${w}w`);
        }
      }
    }
    const srcSet = srcSetEntries.length > 0 ? srcSetEntries.join(", ") : undefined;

    return `{
    id: "${a.id}",
    src: "${primarySrc}",
    alt: ${JSON.stringify(a.altText || "KT Couriers logistics")},
    width: ${a.width || 1440},
    height: ${a.height || 900},
    aspectRatio: ${a.aspectRatio || 1.6},
    focalPoint: [${a.focalPoint ? a.focalPoint[0] : 0.5}, ${a.focalPoint ? a.focalPoint[1] : 0.5}],
    hasAlpha: ${Boolean(a.hasAlpha)},
    ${webpSrc ? `webpSrc: "${webpSrc}",` : ""}
    ${pngSrc ? `pngSrc: "${pngSrc}",` : ""}
    ${srcSet ? `srcSet: "${srcSet}",` : ""}
    desktopCrop: "${a.desktopCrop || "optical-center"}",
    mobileCrop: "${a.mobileCrop || "portrait-slice"}",
    textSafeRegion: "${a.textSafeRegion || "center-clear"}",
    priority: ${a.visualPriority || 2},
    role: "${a.semanticRole || "quiet-utility"}",
  }`;
  }

  // Courier poses array
  const courierPoses = approved
    .filter((a) => a.semanticRole === "protagonist-human")
    .map((a) => toCode(a.id));

  // --- V2 REGISTRY OUTPUT (Backwards compatible) ---
  const v2Content = `/**
 * KT COURIERS — AUTHORITATIVE TYPED MEDIA REGISTRY (v2)
 *
 * Generated from Phase A/B media inventory & Sharp WebP derivation.
 * All route components and scenes import media exclusively through this registry.
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
  priority?: number;
  role?: string;
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
      hero: ${toCode("photo.fashion.rosebank-leather-bags")},
      streetLook1: ${toCode("photo.fashion.jhb-editorial-coat")},
      streetLook2: ${toCode("photo.fashion.jhb-editorial-white")},
      urbanGraffiti: ${toCode("photo.fashion.jhb-street-graffiti")},
    },
    groceries: {
      hero: ${toCode("photo.grocery.fruit-crates-overhead")},
      freshGreens: ${toCode("photo.grocery.vegetables-crate")},
    },
    foodDining: {
      hero: ${toCode("photo.food.prepared-grain-bowl")},
      kitchenPlating: ${toCode("photo.food.kitchen-plating-pass")},
    },
    homeLiving: {
      hero: ${toCode("photo.commerce.cape-town-market-ceramics")},
      interiorVessel: ${toCode("photo.commerce.sculptural-ceramics-vessel")},
    },
    healthWellness: {
      hero: ${toCode("photo.wellness.amber-apothecary-bottles")},
      apothecaryJars: ${toCode("photo.wellness.herbal-jars-dispensary")},
      essentialOils: ${toCode("photo.wellness.organic-botanical-serum")},
    },
  },

  routes: {
    nightTransitCorridor: ${toCode("photo.route.night-highway-transit")},
    aerialHighway: ${toCode("photo.route.overhead-cloverleaf-interchange")},
    gautengTransitLine: ${toCode("photo.route.gauteng-transit-corridor")},
    johannesburgCorridor: ${toCode("photo.route.long-haul-freeway-vista")},
    mabonengWorkshop: ${toCode("photo.prep.maboneng-fleet-depot")},
  },

  documentary: {
    driverArrival: ${toCode("photo.courier.doorstep-driver-arrival")},
    pickup: ${toCode("photo.courier.merchant-pickup-handoff")},
    trackingCheck: ${toCode("photo.courier.digital-manifest-check")},
    handoffDetail: ${toCode("photo.courier.recipient-physical-handoff")},
  },

  auth: {
    customer: ${toCode("photo.courier.recipient-receiving-delivery")},
    merchant: ${toCode("photo.prep.artisan-box-assembly")},
    product: ${toCode("photo.commerce.clean-packaged-goods-stack")},
    recovery: ${toCode("photo.auth.recovery-keycard")},
  },

  illustrations: {
    orderDelivery: ${toCode("illustration.order-delivery")},
    packageDelivery: ${toCode("illustration.package-delivery")},
    gpsLocation: ${toCode("illustration.gps-location")},
    onlineShopping: ${toCode("illustration.kt-ill-online-shopping")},
    motionOrderState: ${toCode("illustration.kt-motion-order-state")},
  },
} as const;

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

export function getMediaSrcSet(asset: KTMediaAsset): string | undefined {
  return asset.srcSet;
}

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

  // --- V3 REGISTRY OUTPUT (Authoritative, typed, comprehensive) ---
  const v3Content = `/**
 * KT COURIERS — AUTHORITATIVE TYPED MEDIA REGISTRY V3
 *
 * Cinematic Production Standard & Asset Registry
 * Connects 191 master assets and role-aware WebP derivatives to the public experience.
 * All public-v3 components and scenes import media exclusively through this registry.
 */

export interface KTMediaV3Asset {
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
  priority: number;
  role: string;
}

export const ktMediaV3 = {
  protagonists: {
    whiteTruck: {
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
      ] as readonly KTMediaV3Asset[],
    },
  },

  editorial: {
    market: {
      rosebankCraft: ${toCode("photo.market.rosebank-craft-stalls")},
      rosebankDialogue: ${toCode("photo.market.rosebank-merchant-dialogue")},
      rosebankPeople: ${toCode("photo.market.rosebank-busy-pathway")},
      rosebankPlants: ${toCode("photo.market.rosebank-succulents-nursery")},
      socialExchange: ${toCode("photo.market.south-african-social-exchange")},
      artisanPortrait: ${toCode("photo.market.local-artisan-portrait")},
      urbanStreet: ${toCode("photo.market.urban-merchant-street")},
      weekendFair: ${toCode("photo.market.weekend-fair-awnings")},
    },
    merchant: {
      boxAssembly: ${toCode("photo.prep.artisan-box-assembly")},
      stagingShelves: ${toCode("photo.prep.store-staging-shelves")},
      wrappingPackaging: ${toCode("photo.prep.wrapping-protective-packaging")},
      boxingApparel: ${toCode("photo.prep.boxing-finished-apparel")},
      woodworkLabeling: ${toCode("photo.prep.artisan-woodwork-labeling")},
      leatherGoodsBoxing: ${toCode("photo.prep.leather-goods-boxing")},
      dispatchDesk: ${toCode("photo.prep.workshop-dispatch-desk")},
      mabonengDepot: ${toCode("photo.prep.maboneng-fleet-depot")},
    },
    courier: {
      doorstepArrival: ${toCode("photo.courier.doorstep-driver-arrival")},
      pickupHandoff: ${toCode("photo.courier.merchant-pickup-handoff")},
      manifestCheck: ${toCode("photo.courier.digital-manifest-check")},
      physicalHandoff: ${toCode("photo.courier.recipient-physical-handoff")},
      customerArrival: ${toCode("photo.courier.recipient-receiving-delivery")},
      driverRoute: ${toCode("photo.courier.south-african-driver-route")},
      teamPortrait: ${toCode("photo.courier.delivery-team-portrait")},
      dispatchWorker: ${toCode("photo.courier.dispatch-staging-worker")},
    },
    fashion: {
      brownCoat: ${toCode("photo.fashion.jhb-editorial-coat")},
      whiteTop: ${toCode("photo.fashion.jhb-editorial-white")},
      streetGraffiti: ${toCode("photo.fashion.jhb-street-graffiti")},
      leatherBags: ${toCode("photo.fashion.rosebank-leather-bags")},
      jewelry: ${toCode("photo.fashion.rosebank-handcrafted-jewelry")},
      garmentRack: ${toCode("photo.fashion.boutique-garment-rack")},
      retailStorefront: ${toCode("photo.fashion.retail-store-front")},
      leatherFootwear: ${toCode("photo.fashion.designer-footwear-leather")},
    },
    food: {
      grainBowl: ${toCode("photo.food.prepared-grain-bowl")},
      kitchenPlating: ${toCode("photo.food.kitchen-plating-pass")},
      bakingBread: ${toCode("photo.food.fresh-baking-bread")},
      restaurantDispatch: ${toCode("photo.food.restaurant-dispatch-counter")},
    },
    grocery: {
      fruitCrates: ${toCode("photo.grocery.fruit-crates-overhead")},
      vegetablesCrate: ${toCode("photo.grocery.vegetables-crate")},
      organicGreens: ${toCode("photo.grocery.organic-greens-table")},
      marketProduce: ${toCode("photo.grocery.market-counter-produce")},
    },
    wellness: {
      apothecaryBottles: ${toCode("photo.wellness.amber-apothecary-bottles")},
      herbalJars: ${toCode("photo.wellness.herbal-jars-dispensary")},
      organicSerum: ${toCode("photo.wellness.organic-botanical-serum")},
      minimalistBottles: ${toCode("photo.wellness.minimalist-wellness-bottles")},
      licensedPharmacy: ${toCode("photo.wellness.licensed-pharmacy-counter")},
      botanicalCompounding: ${toCode("photo.wellness.botanical-extract-compounding")},
      temperatureSensitive: ${toCode("photo.wellness.temperature-sensitive-pack")},
    },
    warehouse: {
      distributionPallets: ${toCode("photo.freight.distribution-center-pallets")},
      highBayRacking: ${toCode("photo.freight.high-bay-warehouse-racking")},
      loadingDocks: ${toCode("photo.freight.loading-dock-freight-doors")},
      intermodalDepot: ${toCode("photo.freight.intermodal-container-depot")},
      heavyForklift: ${toCode("photo.freight.heavy-forklift-pallet-transfer")},
      commercialStaging: ${toCode("photo.freight.commercial-freight-staging-deck")},
      fleetHangar: ${toCode("photo.freight.fleet-maintenance-hangar")},
    },
    route: {
      gautengCorridor: ${toCode("photo.route.gauteng-transit-corridor")},
      nightTransit: ${toCode("photo.route.night-highway-transit")},
      johannesburgGrid: ${toCode("photo.route.johannesburg-street-grid")},
      freewayFlyover: ${toCode("photo.route.metropolitan-freeway-flyover")},
      regionalArterial: ${toCode("photo.route.regional-arterial-connector")},
      cloverleafInterchange: ${toCode("photo.route.overhead-cloverleaf-interchange")},
      longHaulFreeway: ${toCode("photo.route.long-haul-freeway-vista")},
      capeTownTransit: ${toCode("photo.route.cape-town-coastal-transit")},
      crossCountryRoad: ${toCode("photo.route.cross-country-freight-road")},
      johannesburgSkyline: ${toCode("photo.route.johannesburg-skyline-aerial")},
    },
    ceramics: {
      sculpturalVessel: ${toCode("photo.commerce.sculptural-ceramics-vessel")},
      potteryStudio: ${toCode("photo.commerce.pottery-studio-shelving")},
      stonewareTableware: ${toCode("photo.commerce.stoneware-tableware-collection")},
      ceramicVase: ${toCode("photo.commerce.ceramic-vase-sculpture")},
      capeTownPlates: ${toCode("photo.commerce.cape-town-market-ceramics")},
      packagedStack: ${toCode("photo.commerce.clean-packaged-goods-stack")},
      roasteryCounter: ${toCode("photo.commerce.coffee-roastery-counter")},
    },
  },

  pages: {
    homepage: {
      heroPoster: ${toCode("protagonist.truck.white.side-right")},
      trailerTakeover: [
        ${toCode("photo.grocery.fruit-crates-overhead")},
        ${toCode("photo.fashion.rosebank-leather-bags")},
        ${toCode("photo.food.prepared-grain-bowl")},
        ${toCode("photo.commerce.cape-town-market-ceramics")},
        ${toCode("photo.wellness.amber-apothecary-bottles")},
        ${toCode("photo.fashion.rosebank-handcrafted-jewelry")},
      ],
      imageFan: [
        ${toCode("photo.fashion.rosebank-leather-bags")},
        ${toCode("photo.grocery.vegetables-crate")},
        ${toCode("photo.food.prepared-grain-bowl")},
        ${toCode("photo.wellness.amber-apothecary-bottles")},
        ${toCode("photo.commerce.sculptural-ceramics-vessel")},
        ${toCode("photo.fashion.rosebank-handcrafted-jewelry")},
        ${toCode("photo.fashion.jhb-editorial-white")},
      ],
      preparation: ${toCode("photo.prep.artisan-box-assembly")},
      preparationSecondary: ${toCode("photo.prep.store-staging-shelves")},
      collection: {
        van: ${toCode("protagonist.van.side-right")},
        slidingDoor: ${toCode("protagonist.van.sliding-door-open")},
        courier: ${toCode("protagonist.courier.approach-vehicle")},
      },
      custodySplit: {
        merchantSide: ${toCode("photo.courier.merchant-pickup-handoff")},
        courierSide: ${toCode("photo.courier.digital-manifest-check")},
      },
      routePlane: ${toCode("photo.route.gauteng-transit-corridor")},
      freightClimax: {
        background: ${toCode("photo.freight.heavy-forklift-pallet-transfer")},
        truck: ${toCode("protagonist.truck.red.side-right")},
      },
      arrival: {
        background: ${toCode("photo.courier.doorstep-driver-arrival")},
        courierHandoff: ${toCode("photo.courier.recipient-physical-handoff")},
        actor: ${toCode("protagonist.courier.hero-standing")},
      },
    },
    services: {
      overview: {
        parcel: ${toCode("photo.courier.recipient-physical-handoff")},
        ecommerce: ${toCode("photo.prep.artisan-box-assembly")},
        food: ${toCode("photo.food.prepared-grain-bowl")},
        grocery: ${toCode("photo.grocery.fruit-crates-overhead")},
        pharmacy: ${toCode("photo.wellness.amber-apothecary-bottles")},
        moving: ${toCode("photo.freight.commercial-freight-staging-deck")},
        freight: ${toCode("photo.freight.distribution-center-pallets")},
        shuttle: ${toCode("photo.route.night-highway-transit")},
        business: ${toCode("photo.prep.workshop-dispatch-desk")},
        driverNetwork: ${toCode("photo.courier.delivery-team-portrait")},
        pricing: ${toCode("photo.route.long-haul-freeway-vista")},
      },
      parcel: {
        primary: ${toCode("photo.courier.doorstep-driver-arrival")},
        secondary: ${toCode("photo.courier.merchant-pickup-handoff")},
        detail: ${toCode("photo.courier.recipient-physical-handoff")},
      },
      ecommerce: {
        primary: ${toCode("photo.prep.artisan-box-assembly")},
        secondary: ${toCode("photo.prep.store-staging-shelves")},
        detail: ${toCode("photo.prep.boxing-finished-apparel")},
      },
      food: {
        primary: ${toCode("photo.food.kitchen-plating-pass")},
        secondary: ${toCode("photo.food.prepared-grain-bowl")},
        detail: ${toCode("photo.food.restaurant-dispatch-counter")},
      },
      grocery: {
        primary: ${toCode("photo.grocery.fruit-crates-overhead")},
        secondary: ${toCode("photo.grocery.vegetables-crate")},
        detail: ${toCode("photo.grocery.market-counter-produce")},
      },
      pharmacy: {
        primary: ${toCode("photo.wellness.amber-apothecary-bottles")},
        secondary: ${toCode("photo.wellness.herbal-jars-dispensary")},
        detail: ${toCode("photo.wellness.temperature-sensitive-pack")},
      },
      moving: {
        primary: ${toCode("photo.freight.heavy-forklift-pallet-transfer")},
        secondary: ${toCode("photo.freight.commercial-freight-staging-deck")},
        detail: ${toCode("photo.freight.loading-dock-freight-doors")},
      },
      freight: {
        primary: ${toCode("photo.freight.distribution-center-pallets")},
        secondary: ${toCode("photo.freight.high-bay-warehouse-racking")},
        detail: ${toCode("photo.route.cross-country-freight-road")},
      },
      shuttle: {
        primary: ${toCode("photo.route.night-highway-transit")},
        secondary: ${toCode("photo.route.metropolitan-freeway-flyover")},
        detail: ${toCode("photo.route.overhead-cloverleaf-interchange")},
      },
      business: {
        primary: ${toCode("photo.prep.workshop-dispatch-desk")},
        secondary: ${toCode("photo.prep.wrapping-protective-packaging")},
        detail: ${toCode("photo.prep.maboneng-fleet-depot")},
      },
      driverNetwork: {
        primary: ${toCode("photo.courier.delivery-team-portrait")},
        secondary: ${toCode("photo.courier.south-african-driver-route")},
        detail: ${toCode("photo.courier.dispatch-staging-worker")},
      },
      pricing: {
        primary: ${toCode("photo.route.long-haul-freeway-vista")},
        secondary: ${toCode("photo.route.regional-arterial-connector")},
        detail: ${toCode("photo.commerce.clean-packaged-goods-stack")},
      },
    },
    about: {
      photoEssay: [
        ${toCode("photo.market.rosebank-craft-stalls")},
        ${toCode("photo.route.gauteng-transit-corridor")},
        ${toCode("photo.prep.artisan-box-assembly")},
        ${toCode("photo.route.cross-country-freight-road")},
        ${toCode("photo.courier.doorstep-driver-arrival")},
      ],
      portraits: [
        ${toCode("photo.market.local-artisan-portrait")},
        ${toCode("photo.courier.delivery-team-portrait")},
      ],
    },
    coverage: {
      hero: ${toCode("photo.route.gauteng-transit-corridor")},
      capeTown: ${toCode("photo.route.cape-town-coastal-transit")},
      interchange: ${toCode("photo.route.overhead-cloverleaf-interchange")},
      skyline: ${toCode("photo.route.johannesburg-skyline-aerial")},
    },
    join: {
      driverHero: ${toCode("photo.courier.delivery-team-portrait")},
      merchantHero: ${toCode("photo.market.rosebank-merchant-dialogue")},
      transitAction: ${toCode("photo.courier.south-african-driver-route")},
    },
    auth: {
      customer: ${toCode("photo.courier.recipient-receiving-delivery")},
      merchant: ${toCode("photo.prep.artisan-box-assembly")},
      product: ${toCode("photo.commerce.clean-packaged-goods-stack")},
      recovery: ${toCode("photo.auth.recovery-keycard")},
    },
  },

  illustrations: {
    orderDelivery: ${toCode("illustration.order-delivery")},
    packageDelivery: ${toCode("illustration.package-delivery")},
    gpsLocation: ${toCode("illustration.gps-location")},
    onlineShopping: ${toCode("illustration.kt-ill-online-shopping")},
    motionOrderState: ${toCode("illustration.kt-motion-order-state")},
  },
} as const;

export function getMediaV3SrcSet(asset: KTMediaV3Asset): string | undefined {
  return asset.srcSet;
}
`;

  await mkdir(path.dirname(registryV2OutputPath), { recursive: true });
  await writeFile(registryV2OutputPath, v2Content, "utf8");
  console.log(`V2 media registry written to: ${registryV2OutputPath}`);

  await mkdir(path.dirname(registryV3OutputPath), { recursive: true });
  await writeFile(registryV3OutputPath, v3Content, "utf8");
  console.log(`V3 authoritative media registry written to: ${registryV3OutputPath}`);
}

main().catch((err) => {
  console.error("Failed to generate media registry:", err);
  process.exit(1);
});
