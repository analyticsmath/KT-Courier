"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { publicServicePages } from "@/lib/public-services/service-page-registry";
import { getServiceMedia } from "@/lib/public-assets/service-media";
import { KtIconArrowRight } from "@/components/public-v2/graphics/KtIcons";
import styles from "./service-pages.module.css";

export function AtlasViewerClient() {
  const [activeIdx, setActiveIdx] = useState(0);
  const activeService = publicServicePages[activeIdx] || publicServicePages[0];
  const activeMedia = getServiceMedia(activeService.heroMediaId);

  return (
    <div className={styles.atlasInteractiveLayout}>
      {/* Vertical Index of All 11 Services */}
      <ol aria-label="11 Service Routes" className={styles.atlasIndexList}>
        {publicServicePages.map((service, idx) => {
          const isSelected = idx === activeIdx;
          return (
            <li key={service.id}>
              <Link
                className={`${styles.atlasIndexRow} ${
                  isSelected ? styles.atlasIndexRowActive : ""
                }`}
                href={service.route}
                onFocus={() => setActiveIdx(idx)}
                onMouseEnter={() => setActiveIdx(idx)}
              >
                <div className={styles.atlasIndexRowContent}>
                  <span className={styles.atlasIndexRowTitle}>
                    {service.eyebrow}
                  </span>
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
        <div className={styles.atlasPinnedMedia}>
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
        </div>

        <div className={styles.atlasPinnedBody}>
          <h2 className={styles.atlasPinnedHeading}>{activeService.title}</h2>
          <p className={styles.atlasPinnedText}>{activeService.summary}</p>
          <Link className={styles.atlasPinnedAction} href={activeService.route}>
            <span>Explore {activeService.eyebrow}</span>
            <KtIconArrowRight size={16} />
          </Link>
        </div>
      </aside>
    </div>
  );
}
