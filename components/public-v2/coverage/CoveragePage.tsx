import Image from "next/image";
import Link from "next/link";
import { PublicBreadcrumbScript, PublicDataState, SupportingClosingCta, SupportingPageHero } from "@/components/public-v2/support";
import { getSupportingPageMedia } from "@/lib/public-assets/supporting-page-media";
import type { PublicCoverageSnapshot } from "@/lib/public-coverage/coverage";
import styles from "@/components/public-v2/support/support-pages.module.css";

export function CoveragePage({ snapshot }: { snapshot: PublicCoverageSnapshot }) {
  const media = getSupportingPageMedia("coverage-context");
  const regionSummary = snapshot.state === "ACTIVE_REGIONS"
    ? `${snapshot.regions.length} configured public ${snapshot.regions.length === 1 ? "region" : "regions"}`
    : "Availability confirmed from the request";

  return (
    <article className={styles.page}>
      <PublicBreadcrumbScript items={[{ label: "Home", href: "/" }, { label: "Coverage areas", href: "/coverage-areas" }]} />
      <SupportingPageHero
        breadcrumb={[{ label: "Home", href: "/" }, { label: "Coverage areas" }]}
        eyebrow="Coverage areas"
        title="Know where the journey can begin."
        summary={snapshot.state === "ACTIVE_REGIONS"
          ? `The current public configuration lists ${snapshot.regions.length} active ${snapshot.regions.length === 1 ? "region" : "regions"}. Pickup and dropoff suitability is still confirmed from the individual request.`
          : "Public availability is confirmed through the delivery request or a conversation with KT Couriers."}
        primaryAction={{ label: "Get a quote", href: "/account/request-delivery" }}
        secondaryAction={{ label: "Contact KT Couriers", href: "/contact" }}
        media={media}
        variant="geographic"
      />

      <section className={styles.section} aria-labelledby="coverage-state-heading">
        <div className={styles.pageInner}>
          <p className={styles.sectionEyebrow}>Current public configuration</p>
          {snapshot.state === "ACTIVE_REGIONS" ? (
            <div className={styles.coverageLayout}>
              <div>
                <h2 className={styles.sectionHeading} id="coverage-state-heading">{regionSummary}</h2>
                <p className={styles.sectionIntro}>Only regions currently marked active in the delivery-region source are listed here. The list is ordered by the operational display order in that source.</p>
                <ul className={styles.regionList} aria-label="Active delivery regions">
                  {snapshot.regions.map((region) => (
                    <li key={region.id}>
                      <strong>{region.name}</strong>
                      {region.city || region.province ? <span>{[region.city, region.province].filter(Boolean).join(", ")}</span> : null}
                      {region.description ? <span>{region.description}</span> : null}
                    </li>
                  ))}
                </ul>
              </div>
              <figure className={styles.mediaFrame}>
                <Image alt={media.alt} fill sizes="(max-width: 767px) calc(100vw - 40px), 38vw" src={media.src} style={{ objectPosition: media.focalPoint }} />
                <figcaption className={styles.mediaCaption}>Provisional local-road context · not a coverage map</figcaption>
              </figure>
            </div>
          ) : snapshot.state === "EMPTY_CONFIGURATION" ? (
            <PublicDataState eyebrow="Online list unavailable" title="No public regions are currently configured." action={{ label: "Get a quote", href: "/account/request-delivery" }}>
              <p>Online region information has not yet been published. This does not mean service is unavailable everywhere; KT Couriers can confirm a pickup and dropoff through the request or contact path.</p>
            </PublicDataState>
          ) : (
            <PublicDataState eyebrow="Availability confirmation" title="Current region information could not be loaded for this page." action={{ label: "Contact KT Couriers", href: "/contact" }}>
              <p>Availability can still be confirmed when you submit a delivery request or contact the team. This page does not treat an unavailable source as an empty coverage list.</p>
            </PublicDataState>
          )}
        </div>
      </section>

      <section className={styles.section} aria-labelledby="confirmation-heading">
        <div className={styles.pageInner}>
          <p className={styles.sectionEyebrow}>How availability is confirmed</p>
          <div className={styles.split}>
            <h2 className={styles.sectionHeading} id="confirmation-heading">A configured region is the starting point, not the final confirmation.</h2>
            <div>
              <p className={styles.bodyCopy}>The delivery request records the actual pickup, dropoff, parcel, delivery type, and practical notes. KT Couriers reviews that information to confirm current suitability and the next step.</p>
              <p className={styles.bodyCopy}>Specialised or planned services can need additional confirmation because their handling, timing, or practical requirements vary by request.</p>
              <p className={styles.inlineNote}>There is no postcode checker, map-based eligibility result, estimated route time, or live driver location on this page.</p>
              <Link className={styles.textAction} href="/faq#coverage">Read the coverage FAQ <span aria-hidden="true">→</span></Link>
            </div>
          </div>
        </div>
      </section>

      <div className={styles.pageInner}>
        <SupportingClosingCta
          eyebrow="Confirm a handoff"
          title="Start with the pickup and dropoff details."
          summary="A quote request is the canonical route for current availability. Contact KT Couriers if you need help before starting."
          primaryAction={{ label: "Get a quote", href: "/account/request-delivery" }}
          secondaryAction={{ label: "Contact KT Couriers", href: "/contact" }}
        />
      </div>
    </article>
  );
}
