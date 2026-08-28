import { PublicBreadcrumbs } from "@/components/public-v2/navigation";
import type { PublicCoverageSnapshot } from "@/lib/public-coverage/coverage";
import { CoverageInteractiveView } from "./CoverageInteractiveView";
import styles from "./coverage-page.module.css";

interface CoveragePageProps {
  snapshot: PublicCoverageSnapshot;
}

export function CoveragePage({ snapshot }: CoveragePageProps) {
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
            Explore currently configured delivery regions. Store products may be available for browsing, while actual courier collection and delivery depend on configured operational corridors.
          </p>

          <div className={styles.productTruthNotice}>
            <span className={styles.noticeTitle}>Operational Notice</span>
            <p className={styles.noticeText}>
              There is no postcode checker or anonymous live driver location tool on this page. Delivery availability is confirmed through the actual pickup and dropoff coordinates submitted with your request. The system does not treat an unavailable source as an empty coverage list.
            </p>
          </div>
        </div>
      </div>

      <CoverageInteractiveView snapshot={snapshot} />
    </article>
  );
}
