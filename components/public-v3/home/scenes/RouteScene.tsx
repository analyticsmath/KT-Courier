"use client";

import Image from "next/image";
import { ktMediaV3 } from "../../media/kt-media-v3";
import { chapterBudgetVh, mobileChapterBudgetVh } from "../director/home-chapters";
import styles from "../post-hero-scenes.module.css";

interface RouteSceneProps {
  className?: string;
}

/** Road geometry is the route composition; the director places and turns the top-down truck. */
export function RouteScene({ className = "" }: RouteSceneProps) {
  const aerialRoute = ktMediaV3.pages.homepage.routePlane;

  return (
    <section
      className={`${styles.routeSection} kt-home-route ${className}`}
      data-kt-contrast="dark"
      data-kt-scene="route"
      aria-labelledby="route-heading"
      style={{ "--kt-home-budget": chapterBudgetVh("route"), "--kt-home-mobile-budget": mobileChapterBudgetVh("route") } as React.CSSProperties}
    >
      <div className="kt-home-sticky-stage kt-home-route-sticky">
        <div className={styles.routeAerial} aria-hidden="true">
          <Image src={aerialRoute.src} alt="" fill sizes="100vw" className="object-cover object-center contrast-125" />
        </div>
        <svg
          aria-hidden="true"
          className="kt-route-path-plane absolute inset-0 z-[1] h-full w-full pointer-events-none"
          viewBox="0 0 1000 800"
          preserveAspectRatio="none"
        >
          <path
            data-route-path
            d="M -40 610 C 110 680 190 520 330 500 C 470 480 455 360 520 270 C 595 165 730 175 1040 120"
            fill="none"
            stroke="#242a2e"
            strokeWidth="218"
            strokeLinecap="round"
          />
          <path
            d="M -40 610 C 110 680 190 520 330 500 C 470 480 455 360 520 270 C 595 165 730 175 1040 120"
            fill="none"
            stroke="rgba(241,236,226,.65)"
            strokeWidth="4"
            strokeDasharray="18 18"
            strokeLinecap="round"
          />
        </svg>
        <div className={styles.routeOverpassA} aria-hidden="true" />
        <div className={styles.routeOverpassB} aria-hidden="true" />

        <div className={styles.routeContent}>
          <div data-motion="route-copy">
            <h2 id="route-heading">
              On the way.
            </h2>
            <p>
              Once a delivery is accepted, it moves from pickup toward its destination. Delivery status updates are available through customer and store accounts.
            </p>
          </div>
          <div className={styles.routeEvidence}>
            <span>Route evidence</span>
            <p>
              Availability is confirmed from the pickup and drop-off details submitted with the request.
            </p>
          </div>
        </div>

        <div data-actor-anchor="route-truck" className="absolute left-1/2 top-1/2 w-1 h-1 pointer-events-none" aria-hidden="true" />
      </div>
    </section>
  );
}
