import Link from "next/link";
import { PublicBreadcrumbs } from "@/components/public-v2/navigation";
import { PublicCoverageMap } from "@/components/public-v2/maps";
import type { PublicCoverageSnapshot } from "@/lib/public-coverage/coverage";
import { KtIconArrowRight, KtIconArrowUpRight } from "@/components/public-v2/graphics/KtIcons";
import styles from "./coverage-page.module.css";

interface CoveragePageProps {
  snapshot: PublicCoverageSnapshot;
}

export function CoveragePage({ snapshot }: CoveragePageProps) {
  const regions = snapshot.regions;

  return (
    <article className={styles.coverageRoot}>
      <div className={styles.coverageHeaderInner}>
        <div className={styles.breadcrumbs}>
          <PublicBreadcrumbs
            items={[{ label: "Home", href: "/" }, { label: "Coverage Areas" }]}
          />
        </div>

        <div className={styles.heroCopyBlock}>
          <h1 className={styles.heroTitle}>Coverage Areas & Delivery Corridors.</h1>
          <p className={styles.heroLead}>
            Explore active courier hubs across South Africa. Store products may be available for browsing, while actual courier collection and delivery depend on configured operational corridors.
          </p>
        </div>
      </div>

      <div className={styles.coverageSpatialLayout}>
        {/* Map Canvas */}
        <div className={styles.mapCanvasHolder}>
          <PublicCoverageMap
            className={styles.mapElement}
            interactive={true}
            regions={regions}
            showBadge={true}
          />
        </div>

        {/* Region Content & Serviceability Stream */}
        <div className={styles.regionStreamHolder}>
          <div className={styles.productTruthNotice}>
            <span className={styles.noticeTitle}>Operational Notice</span>
            <p className={styles.noticeText}>
              There is no postcode checker or anonymous live driver location tool on this page. Delivery availability is confirmed through the actual pickup and dropoff coordinates submitted with your request. The system does not treat an unavailable source as an empty coverage list.
            </p>
          </div>

          <div className={styles.activeRegionsListSection}>
            <h2 className={styles.sectionHeading}>
              Active Configured Regions ({regions.length})
            </h2>

            {snapshot.state === "SOURCE_UNAVAILABLE" ? (
              <div className={styles.emptyStateCard}>
                <p>Regional directory temporarily unavailable. Active delivery operations continue as normal.</p>
                <Link className={styles.primaryActionButton} href="/contact">
                  Contact operations team &rarr;
                </Link>
              </div>
            ) : snapshot.state === "EMPTY_CONFIGURATION" || regions.length === 0 ? (
              <div className={styles.emptyStateCard}>
                <p>No public delivery regions are currently configured.</p>
                <Link className={styles.primaryActionButton} href="/contact">
                  Contact the team for custom dispatch &rarr;
                </Link>
              </div>
            ) : (
              <ul className={styles.regionsScrollList}>
                {regions.map((region) => (
                  <li className={styles.regionCardButton} key={region.name}>
                    <div className={styles.regionCardHeader}>
                      <span className={styles.regionCardName}>{region.name}</span>
                      <span className={styles.regionCardCoords}>
                        {[region.city, region.province].filter(Boolean).join(", ") || "Active Region"}
                      </span>
                    </div>

                    {region.description && (
                      <p className={styles.regionCardDesc}>{region.description}</p>
                    )}

                    {region.coverageRadiusKm && (
                      <div className={styles.regionRadiusBadge}>
                        Coverage Radius: ~{region.coverageRadiusKm} km
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Action Links */}
          <div className={styles.coverageActionGroup}>
            <Link className={styles.primaryActionButton} href="/account/request-delivery">
              <span>Request delivery quote</span>
              <KtIconArrowRight size={18} />
            </Link>
            <Link className={styles.secondaryActionButton} href="/contact">
              <span>Delivery question?</span>
              <KtIconArrowUpRight size={18} />
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}
