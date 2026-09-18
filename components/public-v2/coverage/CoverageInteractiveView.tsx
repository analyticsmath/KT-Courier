"use client";

import { useState } from "react";
import Link from "next/link";
import { PublicCoverageMap, type PublicDeliveryRegion } from "@/components/public-v2/maps";
import type { PublicCoverageSnapshot } from "@/lib/public-coverage/coverage";
import { KtIconArrowRight, KtIconArrowUpRight } from "@/components/public-v2/graphics/KtIcons";
import { PixelReconstruct } from "@/components/public-v2/motion";
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
          <PixelReconstruct active={true} durationMs={450} key={selectedRegion.name}>
            <div className={styles.corridorTelemetryPanel} data-kt-cursor="EXPLORE">
              <div className={styles.telemetryHeader}>
                <span className={styles.telemetryTitle}>Region Details · {selectedRegion.name}</span>
                <span className={styles.telemetryBadge}>ACTIVE REGION</span>
              </div>

              <div className={styles.routeSimulationTrack}>
                <svg
                  className={styles.routeSvg}
                  fill="none"
                  viewBox="0 0 400 80"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <line stroke="rgba(255,255,255,0.06)" strokeWidth="1" x1="0" x2="400" y1="40" y2="40" />
                  <path
                    className={styles.routePathDrawn}
                    d="M 20 40 C 90 20, 140 60, 200 40 C 260 20, 310 60, 380 40"
                  />
                  <circle cx="20" cy="40" fill="#CF2930" r="4" />
                  <text fill="#8E99A2" fontFamily="monospace" fontSize="9" x="12" y="65">PICKUP</text>
                  <g transform="translate(190, 28)">
                    <rect fill="#FFFFFF" height="16" rx="2" width="28" x="0" y="4" />
                    <rect fill="#347CFB" height="12" opacity="0.8" rx="1" width="6" x="2" y="6" />
                    <rect fill="#CF2930" height="12" width="3" x="22" y="6" />
                    <circle cx="6" cy="3" fill="#0E1012" r="1.5" />
                    <circle cx="22" cy="3" fill="#0E1012" r="1.5" />
                    <circle cx="6" cy="21" fill="#0E1012" r="1.5" />
                    <circle cx="22" cy="21" fill="#0E1012" r="1.5" />
                  </g>
                  <circle cx="380" cy="40" fill="#347CFB" r="4" />
                  <text fill="#8E99A2" fontFamily="monospace" fontSize="9" x="355" y="65">DELIVERY</text>
                </svg>
              </div>

              <div className={styles.telemetryMetaRow}>
                <div className={styles.telemetryStat}>
                  <span className={styles.telemetryStatLabel}>Region</span>
                  <span className={styles.telemetryStatValue}>{selectedRegion.name}</span>
                </div>
                <div className={styles.telemetryStat}>
                  <span className={styles.telemetryStatLabel}>Service Area</span>
                  <span className={styles.telemetryStatValue}>
                    {[selectedRegion.city, selectedRegion.province].filter(Boolean).join(", ") || "Active Region"}
                  </span>
                </div>
                <div className={styles.telemetryStat}>
                  <span className={styles.telemetryStatLabel}>Coverage Range</span>
                  <span className={styles.telemetryStatValue}>
                    {selectedRegion.coverageRadiusKm ? `~${selectedRegion.coverageRadiusKm} km Radius` : "Standard Route"}
                  </span>
                </div>
              </div>
            </div>
          </PixelReconstruct>
        )}

        <div className={styles.activeRegionsListSection}>
          <h2 className={styles.sectionHeading}>
            Delivery Regions ({regions.length})
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
          <Link className={styles.primaryActionButton} href="/services/pricing">
            <span>Calculate delivery estimate</span>
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
