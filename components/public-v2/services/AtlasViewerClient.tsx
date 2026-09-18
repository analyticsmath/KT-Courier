"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { publicServicePages } from "@/lib/public-services/service-page-registry";
import { getServiceMedia } from "@/lib/public-assets/service-media";
import { KtIconArrowRight } from "@/components/public-v2/graphics/KtIcons";
import styles from "./service-pages.module.css";

const protagonistMap: Record<string, { label: string; badge: string }> = {
  freight: { label: "Red Freight Truck", badge: "PROTAGONIST: HEAVY TRANSIT" },
  parcel: { label: "Courier Protagonist", badge: "PROTAGONIST: CUSTODY HANDOFF" },
  grocery: { label: "Urban Delivery Van", badge: "PROTAGONIST: COLD-CHAIN DISPATCH" },
  food: { label: "Urban Delivery Van", badge: "PROTAGONIST: RAPID DISPATCH" },
  pharmacy: { label: "Urban Delivery Van", badge: "PROTAGONIST: SECURE DISPATCH" },
  moving: { label: "White Transit Truck", badge: "PROTAGONIST: VOLUME TRANSIT" },
  shuttle: { label: "Regional Shuttle", badge: "PROTAGONIST: SCHEDULED CORRIDOR" },
  ecommerce: { label: "Merchant Courier Fleet", badge: "PROTAGONIST: FULFILMENT NETWORK" },
  business: { label: "Dedicated Courier Unit", badge: "PROTAGONIST: CONTRACT ROUTE" },
  "driver-network": { label: "Courier Driver Fleet", badge: "PROTAGONIST: DISPATCH CORRIDOR" },
  pricing: { label: "Route Calculation Engine", badge: "PROTAGONIST: TARIFF INTELLIGENCE" },
};

export function AtlasViewerClient() {
  const [activeIdx, setActiveIdx] = useState(0);
  const activeService = publicServicePages[activeIdx] || publicServicePages[0];
  const activeMedia = getServiceMedia(activeService.heroMediaId);
  const protagonist = protagonistMap[activeService.slug] || {
    label: "Courier Fleet",
    badge: "PROTAGONIST: TRANSIT",
  };

  return (
    <div className={styles.atlasInteractiveLayout}>
      {/* Vertical Index of All 11 Services */}
      <ol aria-label="11 Service Routes" className={styles.atlasIndexList}>
        {publicServicePages.map((service, idx) => {
          const isSelected = idx === activeIdx;
          const serviceProto = protagonistMap[service.slug];
          return (
            <li key={service.id}>
              <Link
                className={`${styles.atlasIndexRow} ${
                  isSelected ? styles.atlasIndexRowActive : ""
                }`}
                data-kt-cursor="EXPLORE"
                href={service.route}
                onFocus={() => setActiveIdx(idx)}
                onMouseEnter={() => setActiveIdx(idx)}
              >
                <div className={styles.atlasIndexRowContent}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                    <span className={styles.atlasIndexRowTitle}>
                      {service.eyebrow}
                    </span>
                    {serviceProto && (
                      <span
                        style={{
                          fontFamily: "var(--kt-font-mono, monospace)",
                          fontSize: "0.68rem",
                          color: service.slug === "freight" ? "var(--kt-signal-red, #cf2930)" : "var(--kt-cobalt, #347cfb)",
                          textTransform: "uppercase",
                          letterSpacing: "0.04em",
                        }}
                      >
                        · {serviceProto.label}
                      </span>
                    )}
                  </div>
                  <span className={styles.atlasIndexRowSummary}>
                    {service.summary}
                  </span>
                </div>
                <span className={styles.atlasIndexRowArrow}>
                  <KtIconArrowRight size={18} />
                </span>
              </Link>
            </li>
          );
        })}
      </ol>

      {/* Sticky Media & Details Pinned Stage */}
      <aside aria-label="Service Details Preview" className={styles.atlasPinnedStage}>
        <div className={styles.atlasPinnedMedia} data-kt-cursor="VIEW">
          <Image
            alt={activeMedia.alt}
            fill
            priority
            sizes="(max-width: 1023px) 100vw, 45vw"
            src={activeMedia.src}
            style={{
              objectFit: "cover",
              objectPosition: activeMedia.focalPoint,
            }}
          />
          <div
            style={{
              position: "absolute",
              top: 12,
              left: 12,
              backgroundColor: "rgba(14, 16, 18, 0.85)",
              color: "#ffffff",
              padding: "4px 10px",
              fontFamily: "var(--kt-font-mono, monospace)",
              fontSize: "0.7rem",
              letterSpacing: "0.06em",
              borderLeft: "2px solid var(--kt-signal-red, #cf2930)",
            }}
          >
            {protagonist.badge}
          </div>
        </div>

        <div className={styles.atlasPinnedBody}>
          <h2 className={styles.atlasPinnedHeading}>{activeService.title}</h2>
          <p className={styles.atlasPinnedText}>{activeService.summary}</p>
          <Link
            className={styles.atlasPinnedAction}
            data-kt-cursor="OPEN"
            href={activeService.route}
          >
            <span>Explore {activeService.eyebrow}</span>
            <KtIconArrowRight size={16} />
          </Link>
        </div>
      </aside>
    </div>
  );
}

