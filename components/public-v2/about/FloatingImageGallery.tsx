"use client";

import Image from "next/image";
import { ktMediaV3 } from "@/components/public-v3/media/kt-media-v3";
import styles from "./about-page.module.css";

const galleryItems = [
  {
    id: "people",
    tag: "Merchants & Makers",
    title: "Makers, store owners & dispatchers preparing orders",
    media: ktMediaV3.pages.about.photoEssay[0],
    aspect: "4/5",
  },
  {
    id: "marketplace",
    tag: "Local Storefronts",
    title: "Catalog diversity connecting local commerce",
    media: ktMediaV3.editorial.ceramics.sculpturalVessel,
    aspect: "16/10",
  },
  {
    id: "movement",
    tag: "Regional Transit",
    title: "Transit routes spanning South Africa",
    media: ktMediaV3.pages.about.photoEssay[1],
    aspect: "16/9",
  },
  {
    id: "custody",
    tag: "Doorstep Delivery",
    title: "Verified doorstep delivery & custody handoff",
    media: ktMediaV3.pages.about.photoEssay[4],
    aspect: "3/4",
  },
] as const;

export function FloatingImageGallery() {
  return (
    <section
      aria-label="Commerce in Movement Asymmetrical Gallery"
      className={styles.floatingGallerySection}
    >
      <div className={styles.galleryHeader}>
        <span className={styles.galleryEyebrow}>Trade in Motion</span>
        <h2 className={styles.galleryTitle}>Every order is someone&apos;s trade in transit.</h2>
      </div>

      <div className={styles.floatingAsymmetricGrid}>
        {galleryItems.map((item, idx) => {
          return (
            <div
              className={`${styles.floatingGalleryCard} ${styles[`cardPosition_${idx}`]}`}
              key={item.id}
              tabIndex={0}
            >
              <div
                className={styles.floatingMediaFrame}
                style={{ aspectRatio: item.aspect }}
              >
                <Image
                  alt={item.media.alt}
                  fill
                  sizes="(max-width: 768px) 100vw, 40vw"
                  src={item.media.src}
                  className="object-cover"
                />
                <div className={styles.cardInfoOverlay}>
                  <span className={styles.cardTag}>{item.tag}</span>
                  <p className={styles.cardTitle}>{item.title}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
