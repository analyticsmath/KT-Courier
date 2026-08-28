import { listDeliveryRegions } from "@/lib/services/admin-regions.service";
import { getStorefrontHome } from "@/lib/services/storefront-catalog.service";
import { HomeHeroWorld } from "./HomeHeroWorld";
import { CommerceSelectionField } from "./CommerceSelectionField";
import { PreparationHandoffSequence } from "./PreparationHandoffSequence";
import { RouteGeographySequence } from "./RouteGeographySequence";
import { NetworkCommerceField } from "./NetworkCommerceField";
import { ArrivalResolution } from "./ArrivalResolution";
import { HomepageFinale } from "./HomepageFinale";
import { HomepageMotionController } from "./HomepageMotionController";
import styles from "./home-experience.module.css";

async function readHomepageData() {
  const withinHomepageBudget = <T,>(promise: Promise<T>, fallback: T) =>
    Promise.race([
      promise,
      new Promise<T>((resolve) => setTimeout(() => resolve(fallback), 900)),
    ]);

  const [regions, storefront] = await Promise.all([
    withinHomepageBudget(listDeliveryRegions(true).catch(() => []), []),
    withinHomepageBudget(getStorefrontHome().catch(() => null), null),
  ]);

  return {
    regions: (regions || []).slice(0, 8),
    storefront,
  };
}

export async function HomepageExperience() {
  const { regions } = await readHomepageData();

  return (
    <div className={styles.experienceRoot} data-kt-homepage="package-a">
      <HomepageMotionController />
      <HomeHeroWorld />
      <CommerceSelectionField />
      <PreparationHandoffSequence />
      <RouteGeographySequence regions={regions} />
      <NetworkCommerceField />
      <ArrivalResolution />
      <HomepageFinale />
    </div>
  );
}
