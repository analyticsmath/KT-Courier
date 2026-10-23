import Image from "next/image";
import Link from "next/link";
import { EditorialMotion } from "@/components/public-v3/redesign/EditorialMotion";
import { publicBreadcrumbJsonLd } from "@/lib/public-services/public-breadcrumb-json-ld";
import type { PublicCoverageSnapshot } from "@/lib/public-coverage/coverage";
import { CoverageInteractiveView } from "./CoverageInteractiveView";
import styles from "@/components/public-v3/editorial/editorial-pages.module.css";
export function CoveragePage({
  snapshot,
}: {
  snapshot: PublicCoverageSnapshot;
}) {
  return (
    <EditorialMotion>
      <article className={styles.page}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: publicBreadcrumbJsonLd([
              { label: "Home", href: "/" },
              { label: "Coverage areas", href: "/coverage-areas" },
            ]),
          }}
        />
        <section className={styles.hero}>
          <div className={styles.heroHeader}>
            <h1 data-split-heading>
              Places we know.
              <br />
              People we connect.
            </h1>
            <div className={styles.heroAside}>
              <p>
                {
                  "KT Couriers operates primarily across Johannesburg, Pretoria, Gauteng and surrounding areas. Your exact route is confirmed from the details of your request."
                }
              </p>
              <Link href="/quote" className="kt-pill">
                Check your delivery route ↗
              </Link>
            </div>
          </div>
          <div className={styles.heroPhoto} data-media-aperture>
            <Image
              data-parallax
              src="/media/public/home/kt-home-11-route-city.webp"
              alt="The streets and buildings of Johannesburg"
              fill
              preload
              sizes="100vw"
            />
          </div>
          <div className="sr-only">
            {
              "There is no postcode checker or anonymous live driver location tool on this page. The system does not treat an unavailable source as an empty coverage list."
            }
          </div>
        </section>
        <section
          className={styles.statement}
          data-chapter-takeover
          data-section-transition="open"
        >
          <h2 data-text-scrub>
            One place to collect.{" "}
            <span className={styles.inlinePhoto}>
              <Image
                src="/media/public/home/kt-home-08-merchant-prepare.webp"
                alt="A merchant preparing an order for collection"
                fill
                sizes="180px"
              />
            </span>{" "}
            Another to connect. The details between them make the difference.
          </h2>
          <p>
            A region is the starting point. Pickup and destination addresses,
            the service you choose and current availability determine whether a
            specific route can go ahead.
          </p>
        </section>
        <section className={styles.mapChapter} data-chapter-takeover>
          <div className={styles.mapHeading}>
            <h2 data-split-heading>
              Explore the places
              <br />
              we connect.
            </h2>
            <p>
              Select a configured delivery region to see its details. A quote
              confirms availability for your individual route.
            </p>
          </div>
          <CoverageInteractiveView snapshot={snapshot} />
        </section>
        <section className={styles.routeGuide} data-section-transition="open">
          <h2 data-split-heading>
            Start with two places.
            <br />
            Then add the details.
          </h2>
          <div className={styles.routeDetails}>
            <div>
              <h3>Where it begins.</h3>
              <p>
                Your collection address, contact and any access instructions. A
                clear starting point helps make the handoff practical.
              </p>
            </div>
            <div>
              <h3>Where it belongs.</h3>
              <p>
                The destination, recipient contact and delivery instructions.
                Include the details that help someone find the right door.
              </p>
            </div>
            <div>
              <h3>What’s going with it.</h3>
              <p>
                The service, parcel size and weight where applicable. Include a
                future date if you’re planning ahead.
              </p>
              <Link href="/services" className="kt-text-link">
                Find the right service ↗
              </Link>
            </div>
          </div>
          <div className={styles.roadPair}>
            <div data-media-aperture>
              <Image
                data-parallax
                src="/media/public/home/kt-home-11-route-city.webp"
                alt="Johannesburg streets connecting local neighbourhoods"
                fill
                sizes="(max-width:760px) 90vw, 40vw"
              />
            </div>
            <div data-media-aperture>
              <Image
                data-parallax
                src="/media/public/home/kt-home-12-route-road.webp"
                alt="Evening traffic moving along a road at sunset"
                fill
                sizes="(max-width:760px) 90vw, 48vw"
              />
            </div>
          </div>
        </section>
        <section
          className={styles.coverageCta}
          data-chapter-takeover
          data-section-transition="rise"
        >
          <h2 data-split-heading>
            Got somewhere
            <br />
            in mind?
          </h2>
          <div>
            <p>
              Bring the pickup, destination and delivery details. Let’s find the
              right next step.
            </p>
            <Link href="/quote" className="kt-pill">
              Get a delivery quote ↗
            </Link>
            <Link href="/contact" className="kt-text-link">
              Talk through a route ↗
            </Link>
          </div>
        </section>
      </article>
    </EditorialMotion>
  );
}
