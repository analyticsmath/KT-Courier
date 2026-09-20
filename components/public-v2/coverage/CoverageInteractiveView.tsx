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
  const selectedRegion = regions[selectedIdx] || regions[0];

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
          <span className={styles.noticeTitle}>Delivery Verification</span>
          <p className={styles.noticeText}>
            Availability is confirmed from the pickup and drop-off details in your request. For custom cross-provincial dispatches, contact our operations team.
          </p>
        </div>

        {selectedRegion && (
          <div className={styles.corridorTelemetryPanel} style={{ padding: "1.5rem" }}>
            <div className={styles.telemetryHeader} style={{ marginBottom: "1rem" }}>
              <span className={styles.telemetryTitle}>Region · {selectedRegion.name}</span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "1rem", borderTop: "1px solid var(--kt-concrete, #D1CEC6)/30", paddingTop: "1rem" }}>
              <div>
                <span style={{ fontSize: "0.75rem", textTransform: "uppercase", color: "var(--kt-road-grey, #6B6E6A)", display: "block" }}>Location</span>
                <span style={{ fontSize: "0.95rem", fontWeight: 600, color: "var(--kt-asphalt, #101210)" }}>
                  {[selectedRegion.city, selectedRegion.province].filter(Boolean).join(", ") || "Active Region"}
                </span>
              </div>
              {selectedRegion.coverageRadiusKm && (
                <div>
                  <span style={{ fontSize: "0.75rem", textTransform: "uppercase", color: "var(--kt-road-grey, #6B6E6A)", display: "block" }}>Service Range</span>
                  <span style={{ fontSize: "0.95rem", fontWeight: 600, color: "var(--kt-asphalt, #101210)" }}>
                    ~{selectedRegion.coverageRadiusKm} km Radius
                  </span>
                </div>
              )}
            </div>
            {selectedRegion.description && (
              <p style={{ marginTop: "1rem", fontSize: "0.9rem", color: "var(--kt-road-grey, #6B6E6A)", lineHeight: 1.5 }}>
                {selectedRegion.description}
              </p>
            )}
          </div>
        )}

        <div className={styles.activeRegionsListSection}>
          <h2 className={styles.sectionHeading}>
            {snapshot.state === "ACTIVE_REGIONS"
              ? `Delivery Regions (${regions.length})`
              : snapshot.state === "SOURCE_UNAVAILABLE"
                ? "Delivery Regions · updating"
                : "Coverage list being updated"}
          </h2>

          {snapshot.state === "SOURCE_UNAVAILABLE" ? (
            <div className={styles.emptyStateCard}>
              <p>Our delivery region list is currently updating. Active delivery operations continue as normal. Contact our team to confirm service for your route.</p>
              <Link className={styles.primaryActionButton} href="/contact">
                Contact operations team &rarr;
              </Link>
            </div>
          ) : snapshot.state === "EMPTY_CONFIGURATION" || regions.length === 0 ? (
            <div className={styles.emptyStateCard}>
              <p>We’re updating the public coverage list. Availability is confirmed from the pickup and drop-off details in your request.</p>
              <Link className={styles.primaryActionButton} href="/contact">
                Contact the team to check availability &rarr;
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
          <Link className="kt-action-filled" href="/services/pricing">
            <span>View pricing factors</span>
            <KtIconArrowRight size={16} />
          </Link>
          <Link className="kt-action-outline" href="/contact">
            <span>Delivery question?</span>
            <KtIconArrowUpRight size={16} />
          </Link>
        </div>
      </div>
    </div>
  );
}
