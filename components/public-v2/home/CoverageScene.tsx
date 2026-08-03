import Link from "next/link";
import { RouteLine } from "@/components/public-v2/graphics";
import { ArtDirectedImage } from "@/components/public-v2/media";
import { homepageMedia } from "@/lib/public-assets/homepage-media";
import { listDeliveryRegions } from "@/lib/services/admin-regions.service";
import styles from "./homepage-v2.module.css";

export async function CoverageScene() {
  let regions: Awaited<ReturnType<typeof listDeliveryRegions>> = [];

  try {
    regions = await listDeliveryRegions(true);
  } catch {
    regions = [];
  }

  const configuredRegionNames = regions.slice(0, 3).map((region) => region.name);

  return (
    <section aria-labelledby="coverage-heading" className={styles.coverageSection}>
      <div className={styles.sectionInner}>
        <div className={styles.coverageVisual}>
          <ArtDirectedImage
            alt={homepageMedia.coverage.alt}
            className={styles.coverageImage}
            desktopSrc={homepageMedia.coverage.desktop!.src}
            height={homepageMedia.coverage.desktop!.height}
            mobileSrc={homepageMedia.coverage.mobile!.src}
            sizes="(max-width: 767px) 100vw, 58vw"
            tabletSrc={homepageMedia.coverage.desktop!.src}
            width={homepageMedia.coverage.desktop!.width}
          />
          <RouteLine className={styles.coverageLine} segment="network" variant="network" />
        </div>
        <div className={styles.coverageCopy}>
          <p className={styles.sectionMarker}>Coverage</p>
          <h2 id="coverage-heading">Local context. Clear coverage.</h2>
          <p>
            KT Couriers operates within local service areas. Coverage is confirmed when a delivery request is reviewed, and it can vary by delivery type.
          </p>
          {configuredRegionNames.length > 0 ? (
            <p className={styles.configuredRegions}>Configured service areas: {configuredRegionNames.join(" · ")}</p>
          ) : (
            <p className={styles.configuredRegions}>Need to check a location? Contact the team with your pickup and dropoff addresses.</p>
          )}
          <div className={styles.textActions}>
            <Link className={styles.textActionPrimary} href="/coverage-areas">View coverage areas</Link>
            <Link className={styles.textAction} href="/contact">Contact support <span aria-hidden="true">→</span></Link>
          </div>
        </div>
      </div>
    </section>
  );
}
