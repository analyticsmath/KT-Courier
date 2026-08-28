import { listDeliveryRegions } from "@/lib/services/admin-regions.service";
import { getStorefrontHome } from "@/lib/services/storefront-catalog.service";
import { HomeHeroWorld } from "./HomeHeroWorld";
import { CommerceJourneyCrawler } from "./CommerceJourneyCrawler";
import { PreparationScene } from "./PreparationScene";
import { HandoffScene } from "./HandoffScene";
import { RouteGeographyScene } from "./RouteGeographyScene";
import { NetworkFieldScene } from "./NetworkFieldScene";
import { ArrivalScene } from "./ArrivalScene";
import { HomepageFinale } from "./HomepageFinale";
import { HomepageMotionController } from "./HomepageMotionController";
import styles from "./home-journey.module.css";

async function readHomepageData() {
  const withinBudget = <T,>(promise: Promise<T>, fallback: T) =>
    Promise.race([
      promise,
      new Promise<T>((resolve) => setTimeout(() => resolve(fallback), 1200)),
    ]);

  const [regions, storefront] = await Promise.all([
    withinBudget(listDeliveryRegions(true).catch(() => []), []),
    withinBudget(getStorefrontHome().catch(() => null), null),
  ]);

  return {
    regions: (regions || []).slice(0, 8),
    categories: storefront?.categories || [],
    stores: storefront?.stores || [],
  };
}

export async function HomepageExperience() {
  const { regions, categories } = await readHomepageData();

  return (
    <div className={styles.journeyRoot} data-kt-experience="master-rebuild">
      <HomepageMotionController />
      <HomeHeroWorld />
      <CommerceJourneyCrawler categories={categories} />
      <PreparationScene />
      <HandoffScene />
      <RouteGeographyScene regions={regions} />
      <NetworkFieldScene categories={categories} />
      <ArrivalScene />
      <HomepageFinale />
    </div>
  );
}
