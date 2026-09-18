"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { type PublicDeliveryRegion } from "@/components/public-v2/maps";
import { ktMedia } from "@/components/public-v2/media";
import { PixelReconstruct } from "@/components/public-v2/motion/transitions/PixelReconstruct";
import { KtIconArrowRight } from "@/components/public-v2/graphics/KtIcons";
import styles from "./home-journey.module.css";

interface RouteGeographySceneProps {
  regions: readonly PublicDeliveryRegion[];
}

export function RouteGeographyScene({ regions }: RouteGeographySceneProps) {
  const [selectedIdx, setSelectedIdx] = useState(0);
  const activeRegion = regions[selectedIdx] || regions[0];
  const topDownTruck = ktMedia.home.heroTruck.topDownStraight;
  const highwayMedia = ktMedia.routes.aerialHighway;

  return (
    <section
      aria-labelledby="route-heading"
      className={styles.routeTrackingScene}
      data-scene="route"
    >
      <div className={styles.routeContainer}>
        {/* Narrative Header */}
        <div className={styles.routeHeader} data-actor="route-copy">
          <span className={styles.routeChapterTag}>
            STATE 11 — ROUTE / TRACKING
          </span>
          <h2 className={styles.routeMainTitle} id="route-heading">
            Corridor Traversal & Geometry
          </h2>
          <p className={styles.routeLead}>
            Vehicle coordinates plot across verified provincial transit arteries. Real-time telemetry maintains custody integrity.
          </p>
        </div>

        {/* Dynamic Route Display Stage: Top-Down Vehicle + SVG Route Draw + Road Parallax */}
        <div className={styles.routeVisualsComposition} data-actor="route-visuals">
          {/* Back: Highway Documentary Road Media with Parallax */}
          <div className={styles.routeHighwaySlot} data-actor="route-road">
            <Image
              alt={highwayMedia.alt}
              src={highwayMedia.src}
              fill
              priority
              sizes="(max-width: 1023px) 100vw, 75vw"
              className={styles.routeHighwayImg}
            />
            <div className={styles.routeHighwayScrim} />
          </div>

          {/* Middle: SVG Route Draw Vector Line */}
          <div className={styles.routeSvgLayer} data-actor="route-svg-line">
            <svg
              className="w-full h-full"
              viewBox="0 0 1000 400"
              fill="none"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <path
                d="M 50,350 Q 300,320 500,200 T 950,50"
                stroke="#347CFB"
                strokeWidth="4"
                strokeDasharray="8 6"
                className={styles.routeAnimatedSvgPath}
              />
            </svg>
          </div>

          {/* Front: Top-View Truck Protagonist on Route */}
          <div className={styles.routeTopDownTruckStage} data-actor="route-top-truck">
            <Image
              alt={topDownTruck.alt}
              src={topDownTruck.src}
              fill
              sizes="(max-width: 767px) 240px, 460px"
              className="object-contain"
            />
          </div>

          {/* Telemetry Coordinate Overlay using Compulsory Pixel Transition */}
          <div className={styles.routeTelemetryPixelBox}>
            <PixelReconstruct pixelSize={6} durationMs={700}>
              <div className={styles.routePixelCard}>
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#D9DEE2]/20">
                  <span className="text-[10px] font-mono tracking-wider text-[#347CFB] uppercase font-bold">
                    ROUTE TELEMETRY
                  </span>
                  <span className="text-[10px] font-mono text-[#F3F1EA]/80">
                    LIVE
                  </span>
                </div>
                <div className="text-[12px] font-mono text-[#F3F1EA] font-semibold">
                  HUB: {activeRegion?.name || "Gauteng Central"}
                </div>
                <div className="text-[10px] font-mono text-[#59626A] mt-1">
                  CORRIDOR LAT: -26.1952° S · LONG: 28.0340° E
                </div>
              </div>
            </PixelReconstruct>
          </div>
        </div>

        {/* Real Configured Coverage Hubs Selector */}
        {regions.length > 0 && (
          <div className={styles.routeHubsBar}>
            <span className={styles.routeHubsLabel}>CONFIGURED HUBS:</span>
            <div className={styles.routeHubsPills}>
              {regions.slice(0, 5).map((region, idx) => {
                const isSelected = idx === selectedIdx;
                return (
                  <button
                    key={region.name}
                    type="button"
                    onClick={() => setSelectedIdx(idx)}
                    className={`${styles.routeHubPill} ${
                      isSelected ? styles.routeHubPillActive : ""
                    }`}
                    data-kt-sticky-mode="SELECT"
                  >
                    <span>{region.name}</span>
                  </button>
                );
              })}
            </div>
            <Link
              href="/coverage-areas"
              className={styles.routeAllCoverageLink}
              data-kt-sticky-mode="EXPLORE"
            >
              <span>Coverage atlas</span>
              <KtIconArrowRight size={14} />
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
