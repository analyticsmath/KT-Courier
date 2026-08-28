import Image from "next/image";
import { KtAnimatedSvg } from "@/components/public-v2/motion/KtAnimatedSvg";
import { homeMedia } from "./home-media";
import styles from "./home-experience.module.css";

interface RouteGeographySequenceProps {
  regions: Array<{ name: string; slug?: string }>;
}

export function RouteGeographySequence({ regions }: RouteGeographySequenceProps) {
  const displayRegions = regions.length > 0
    ? regions
    : [
        { name: "Greater Johannesburg" },
        { name: "Pretoria & Tshwane" },
        { name: "Cape Town Metro" },
        { name: "Durban Central" },
        { name: "Sandton Corridor" },
        { name: "Rosebank & Randburg" },
      ];

  return (
    <section aria-labelledby="route-title" className={styles.routeScene} data-scene="route">
      <div className={styles.routeGrid}>
        <div className={styles.routeInfoSide} data-actor="route-text">
          <span style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--kt-red)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
            Stage 03 &middot; Movement
          </span>
          <h2 className={styles.routeHeading} id="route-title">
            Now it moves.
          </h2>
          <p className={styles.routeSubheading}>
            Navigating urban corridors and arterial transit routes with systematic dispatch.
          </p>

          <div>
            <h4 style={{ fontSize: "0.9rem", fontWeight: 600, color: "var(--kt-carbon)", marginBottom: 8 }}>
              Active Service & Coverage Regions
            </h4>
            <div className={styles.routeRegionsList}>
              {displayRegions.map((region) => (
                <span className={styles.routeRegionPill} key={region.name}>
                  {region.name}
                </span>
              ))}
            </div>
          </div>

          <p className={styles.routeTruthNotice}>
            * Coverage and availability are verified through pickup and drop-off coordinates. Status tracking updates in your account dashboard.
          </p>
        </div>

        <div className={styles.routeVisualSide} data-actor="route-visuals">
          <div className={styles.routeMapCard} data-actor="route-map">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--kt-carbon)" }}>South Africa Network</span>
              <div style={{ width: 28, height: 28 }}>
                <KtAnimatedSvg
                  alt={homeMedia.motionRouteLocation.alt}
                  src={homeMedia.motionRouteLocation.src}
                />
              </div>
            </div>
            <svg aria-label="South Africa Route Map" role="img" style={{ width: "100%", height: 180 }} viewBox="0 0 420 310">
              <path
                d="M80 33 155 17l63 30 23 42 72 31-7 55 49 37-35 44-18 39-85-2-52-29-43 18-54-39 11-73-28-50 39-41z"
                fill="var(--kt-cool-100)"
                stroke="var(--kt-cool-300)"
                strokeWidth="1.5"
              />
              {/* Route lines */}
              <path
                d="M210 110 L270 140 L260 210 L190 240 L120 230"
                fill="none"
                stroke="var(--kt-carbon)"
                strokeDasharray="4 4"
                strokeWidth="2"
              />
              {/* Nodes */}
              <circle cx="210" cy="110" fill="var(--kt-red)" r="5" />
              <circle cx="270" cy="140" fill="var(--kt-carbon)" r="4" />
              <circle cx="260" cy="210" fill="var(--kt-carbon)" r="4" />
              <circle cx="120" cy="230" fill="var(--kt-red)" r="5" />
            </svg>
          </div>

          <div className={styles.routeRoadCard} data-actor="route-road">
            <Image
              alt={homeMedia.routeRoad.alt}
              fill
              sizes="(max-width: 1023px) 100vw, 45vw"
              src={homeMedia.routeRoad.src}
              style={{ objectFit: "cover", objectPosition: homeMedia.routeRoad.objectPosition }}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
