import Link from "next/link";
import { listDeliveryRegions } from "@/lib/services/admin-regions.service";
import type { PublicServicePageDefinition } from "@/lib/public-services/service-page-registry";
import styles from "./service-pages.module.css";

export async function ServiceCoverage({ service }: { service: PublicServicePageDefinition }) {
  let regions: Awaited<ReturnType<typeof listDeliveryRegions>> = [];

  try {
    regions = await listDeliveryRegions(true);
  } catch {
    regions = [];
  }

  const regionNames = regions.slice(0, 4).map((region) => region.name);
  const shouldListConfiguredRegions = service.coverageMode === "ACTIVE_REGIONS" && regionNames.length > 0;

  return (
    <section aria-labelledby={`${service.slug}-coverage-heading`} className={styles.section}>
      <div className={styles.coveragePanel}>
        <div className={styles.coverageCopy}>
          <p className={styles.coverageLabel}>Coverage and availability</p>
          <h2 className={styles.coverageTitle} id={`${service.slug}-coverage-heading`}>Local context, confirmed for the request.</h2>
          <p>KT Couriers operates within local service areas. Pickup and dropoff suitability is confirmed when a request is reviewed, and it can vary by delivery type.</p>
        </div>
        <div>
          {shouldListConfiguredRegions ? (
            <>
              <p className={styles.coverageLabel}>Configured service areas</p>
              <ul className={styles.regionList}>{regionNames.map((region) => <li key={region}>{region}</li>)}</ul>
            </>
          ) : (
            <p className={styles.coverageFallback}>Need to check a location? Share your pickup and dropoff addresses with the team.</p>
          )}
          <div className={styles.actionGroup}>
            <Link className={styles.textAction} href="/coverage-areas">View coverage areas</Link>
            <Link className={styles.textAction} href="/contact">Contact support <span aria-hidden="true">→</span></Link>
          </div>
        </div>
      </div>
    </section>
  );
}
