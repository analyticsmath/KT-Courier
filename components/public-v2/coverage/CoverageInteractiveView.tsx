"use client";

import { useState } from "react";
import Link from "next/link";
import { PublicCoverageMap, type PublicDeliveryRegion } from "@/components/public-v2/maps";
import type { PublicCoverageSnapshot } from "@/lib/public-coverage/coverage";
import { KtIconArrowRight, KtIconArrowUpRight } from "@/components/public-v2/graphics/KtIcons";
import styles from "./coverage-page.module.css";

interface CoverageInteractiveViewProps {
  snapshot: PublicCoverageSnapshot;
}

export function CoverageInteractiveView({ snapshot }: CoverageInteractiveViewProps) {
  const [selectedIdx, setSelectedIdx] = useState(0);
  const regions: readonly PublicDeliveryRegion[] = snapshot.regions;

  return (
    <div className={styles.coverageSpatialLayout}>
      {/* Interactive Map Canvas */}
      <div className={styles.mapCanvasHolder}>
        <PublicCoverageMap
          className={styles.mapElement}
          interactive={true}
          onSelectIndex={setSelectedIdx}
          regions={regions}
          selectedIndex={selectedIdx}
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
            Configured Delivery Regions ({regions.length})
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
              {regions.map((region, idx) => {
                const isSelected = idx === selectedIdx;
                return (
                  <li key={region.name}>
                    <button
                      className={`${styles.regionCardButton} ${
                        isSelected ? styles.regionCardButtonActive : ""
                      }`}
                      onClick={() => setSelectedIdx(idx)}
                      onFocus={() => setSelectedIdx(idx)}
                      type="button"
                    >
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
                    </button>
                  </li>
                );
              })}
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
  );
}
