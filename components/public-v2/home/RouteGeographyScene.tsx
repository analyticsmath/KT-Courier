"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { PublicCoverageMap, type PublicDeliveryRegion } from "@/components/public-v2/maps";
import { homeMedia } from "./home-media";
import styles from "./home-journey.module.css";

interface RouteGeographySceneProps {
  regions: readonly PublicDeliveryRegion[];
}

export function RouteGeographyScene({ regions }: RouteGeographySceneProps) {
  const [selectedIdx, setSelectedIdx] = useState(0);

  return (
    <section
      aria-labelledby="route-heading"
      className={styles.routeScene}
      data-scene="route"
    >
      <div className={styles.routeInner}>
        <div className={styles.routeInfoPanel} data-actor="route-panel">
          <div className={styles.routeMainCopy}>
            <h2 className={styles.routeTitle} id="route-heading">
              Now it moves.
            </h2>
            <p className={styles.routeSub}>
              Navigating urban corridors, arterial transit routes, and local neighborhoods. Availability and route details depend on the submitted request.
            </p>
          </div>

          <div className={styles.routeRegionSection}>
            <span className={styles.routeRegionHeading}>Configured Delivery Hubs</span>
            <ul className={styles.routeRegionList}>
              {regions.slice(0, 5).map((region, idx) => {
                const isSelected = idx === selectedIdx;
                return (
                  <li key={region.name}>
                    <button
                      className={`${styles.routeRegionButton} ${
                        isSelected ? styles.routeRegionButtonActive : ""
                      }`}
                      onClick={() => setSelectedIdx(idx)}
                      type="button"
                    >
                      <span>{region.name}</span>
                      <span style={{ fontSize: "0.75rem", opacity: 0.8 }}>
                        {region.city || "Active"}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>

            <Link
              className={styles.heroCommandPrimary}
              href="/coverage-areas"
              style={{ marginTop: 12 }}
            >
              View coverage areas &rarr;
            </Link>
          </div>
        </div>

        <div className={styles.routeVisualsContainer} data-actor="route-visuals">
          <div className={styles.routeMapSlot} data-actor="route-map">
            <PublicCoverageMap
              interactive={false}
              onSelectIndex={setSelectedIdx}
              regions={regions}
              selectedIndex={selectedIdx}
              showBadge={true}
            />
          </div>

          <div className={styles.routeRoadSlot} data-actor="route-road">
            <Image
              alt={homeMedia.routeRoad.alt}
              fill
              sizes="(max-width: 1023px) 100vw, 40vw"
              src={homeMedia.routeRoad.src}
              style={{
                objectFit: "cover",
                objectPosition: homeMedia.routeRoad.objectPosition,
              }}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
