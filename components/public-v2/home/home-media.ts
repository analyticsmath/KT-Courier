import { ktMedia, type KTMediaAsset } from "@/components/public-v2/media";

export interface HomeMediaItem {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  objectPosition?: string;
  profile?: "hero" | "category" | "large" | "alpha";
  asset?: KTMediaAsset;
}

export const homeMedia = {
  worldMarket: {
    src: ktMedia.routes.aerialHighway.src,
    alt: ktMedia.routes.aerialHighway.alt,
    width: ktMedia.routes.aerialHighway.width,
    height: ktMedia.routes.aerialHighway.height,
    objectPosition: "50% 48%",
    profile: "hero",
    asset: ktMedia.routes.aerialHighway,
  },
  heroTruck: {
    src: ktMedia.home.heroTruck.sideRight.src,
    alt: ktMedia.home.heroTruck.sideRight.alt,
    width: ktMedia.home.heroTruck.sideRight.width,
    height: ktMedia.home.heroTruck.sideRight.height,
    objectPosition: "50% 50%",
    profile: "hero",
    asset: ktMedia.home.heroTruck.sideRight,
  },
  retailLocal: {
    src: ktMedia.categories.fashion.hero.src,
    alt: ktMedia.categories.fashion.hero.alt,
    width: ktMedia.categories.fashion.hero.width,
    height: ktMedia.categories.fashion.hero.height,
    objectPosition: "50% 52%",
    profile: "category",
    asset: ktMedia.categories.fashion.hero,
  },
  foodLocal: {
    src: ktMedia.categories.foodDining.hero.src,
    alt: ktMedia.categories.foodDining.hero.alt,
    width: ktMedia.categories.foodDining.hero.width,
    height: ktMedia.categories.foodDining.hero.height,
    objectPosition: "50% 52%",
    profile: "category",
    asset: ktMedia.categories.foodDining.hero,
  },
  grocery: {
    src: ktMedia.categories.groceries.hero.src,
    alt: ktMedia.categories.groceries.hero.alt,
    width: ktMedia.categories.groceries.hero.width,
    height: ktMedia.categories.groceries.hero.height,
    objectPosition: "48% 50%",
    profile: "category",
    asset: ktMedia.categories.groceries.hero,
  },
  fashion: {
    src: ktMedia.categories.fashion.streetLook1.src,
    alt: ktMedia.categories.fashion.streetLook1.alt,
    width: ktMedia.categories.fashion.streetLook1.width,
    height: ktMedia.categories.fashion.streetLook1.height,
    objectPosition: "50% 48%",
    profile: "category",
    asset: ktMedia.categories.fashion.streetLook1,
  },
  fashionCutout: {
    src: ktMedia.home.heroTruck.sideRight.src,
    alt: ktMedia.home.heroTruck.sideRight.alt,
    profile: "alpha",
    asset: ktMedia.home.heroTruck.sideRight,
  },
  wellness: {
    src: ktMedia.categories.healthWellness.hero.src,
    alt: ktMedia.categories.healthWellness.hero.alt,
    width: ktMedia.categories.healthWellness.hero.width,
    height: ktMedia.categories.healthWellness.hero.height,
    objectPosition: "50% 50%",
    profile: "category",
    asset: ktMedia.categories.healthWellness.hero,
  },
  wellnessCutout: {
    src: ktMedia.categories.healthWellness.apothecaryJars.src,
    alt: ktMedia.categories.healthWellness.apothecaryJars.alt,
    profile: "alpha",
    asset: ktMedia.categories.healthWellness.apothecaryJars,
  },
  homeware: {
    src: ktMedia.categories.homeLiving.hero.src,
    alt: ktMedia.categories.homeLiving.hero.alt,
    width: ktMedia.categories.homeLiving.hero.width,
    height: ktMedia.categories.homeLiving.hero.height,
    objectPosition: "50% 50%",
    profile: "category",
    asset: ktMedia.categories.homeLiving.hero,
  },
  merchantPrepare: {
    src: ktMedia.documentary.pickup.src,
    alt: ktMedia.documentary.pickup.alt,
    width: ktMedia.documentary.pickup.width,
    height: ktMedia.documentary.pickup.height,
    objectPosition: "50% 48%",
    profile: "large",
    asset: ktMedia.documentary.pickup,
  },
  packageDetail: {
    src: ktMedia.documentary.handoffDetail.src,
    alt: ktMedia.documentary.handoffDetail.alt,
    width: ktMedia.documentary.handoffDetail.width,
    height: ktMedia.documentary.handoffDetail.height,
    objectPosition: "50% 50%",
    profile: "category",
    asset: ktMedia.documentary.handoffDetail,
  },
  handoff: {
    src: ktMedia.home.courier.readyHandover.src,
    alt: ktMedia.home.courier.readyHandover.alt,
    width: ktMedia.home.courier.readyHandover.width,
    height: ktMedia.home.courier.readyHandover.height,
    objectPosition: "50% 50%",
    profile: "large",
    asset: ktMedia.home.courier.readyHandover,
  },
  routeCity: {
    src: ktMedia.routes.johannesburgCorridor.src,
    alt: ktMedia.routes.johannesburgCorridor.alt,
    width: ktMedia.routes.johannesburgCorridor.width,
    height: ktMedia.routes.johannesburgCorridor.height,
    objectPosition: "50% 50%",
    profile: "large",
    asset: ktMedia.routes.johannesburgCorridor,
  },
  routeRoad: {
    src: ktMedia.routes.aerialHighway.src,
    alt: ktMedia.routes.aerialHighway.alt,
    width: ktMedia.routes.aerialHighway.width,
    height: ktMedia.routes.aerialHighway.height,
    objectPosition: "50% 50%",
    profile: "large",
    asset: ktMedia.routes.aerialHighway,
  },
  arrival: {
    src: ktMedia.home.courier.heroStanding.src,
    alt: ktMedia.home.courier.heroStanding.alt,
    width: ktMedia.home.courier.heroStanding.width,
    height: ktMedia.home.courier.heroStanding.height,
    objectPosition: "50% 50%",
    profile: "large",
    asset: ktMedia.home.courier.heroStanding,
  },
  motionOrderState: {
    src: ktMedia.illustrations.motionOrderState.src,
    alt: ktMedia.illustrations.motionOrderState.alt,
  },
  motionRouteLocation: {
    src: ktMedia.illustrations.gpsLocation.src,
    alt: ktMedia.illustrations.gpsLocation.alt,
  },
  motionArrival: {
    src: ktMedia.illustrations.packageDelivery.src,
    alt: ktMedia.illustrations.packageDelivery.alt,
  },
} as const;
