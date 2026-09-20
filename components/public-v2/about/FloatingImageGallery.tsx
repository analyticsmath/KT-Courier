"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { motion } from "motion/react";
import { ktMediaV3 } from "@/components/public-v3/media/kt-media-v3";
import { useFinePointer } from "@/components/public-v2/motion/useFinePointer";
import { usePublicMotionPreference } from "@/components/public-v2/motion/usePublicMotionPreference";
import styles from "./about-page.module.css";

const galleryItems = [
  {
    id: "people",
    tag: "Merchants & Makers",
    title: "Makers, store owners & dispatchers preparing orders",
    media: ktMediaV3.pages.about.photoEssay[0],
    aspect: "4/5",
    depthFactor: 12,
  },
  {
    id: "marketplace",
    tag: "Local Storefronts",
    title: "Catalog diversity connecting local commerce",
    media: ktMediaV3.editorial.ceramics.sculpturalVessel,
    aspect: "16/10",
    depthFactor: 20,
  },
  {
    id: "movement",
    tag: "Regional Transit",
    title: "Transit routes spanning South Africa",
    media: ktMediaV3.pages.about.photoEssay[1],
    aspect: "16/9",
    depthFactor: 16,
  },
  {
    id: "custody",
    tag: "Doorstep Delivery",
    title: "Verified doorstep delivery & custody handoff",
    media: ktMediaV3.pages.about.photoEssay[4],
    aspect: "3/4",
    depthFactor: 24,
  },
] as const;

export function FloatingImageGallery() {
  const isFinePointer = useFinePointer();
  const { prefersReducedMotion } = usePublicMotionPreference();
  const containerRef = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isFinePointer || prefersReducedMotion || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const relativeX = (e.clientX - rect.left) / rect.width - 0.5;
    const relativeY = (e.clientY - rect.top) / rect.height - 0.5;
    setOffset({ x: relativeX, y: relativeY });
  };

  const handleMouseLeave = () => {
    setOffset({ x: 0, y: 0 });
  };

  return (
    <section
      aria-label="Commerce in Movement Asymmetrical Gallery"
      className={styles.floatingGallerySection}
      data-kt-cursor="EXPLORE"
      onMouseLeave={handleMouseLeave}
      onMouseMove={handleMouseMove}
      ref={containerRef}
    >
      <div className={styles.galleryHeader}>
        <span className={styles.galleryEyebrow}>Trade in Motion</span>
        <h2 className={styles.galleryTitle}>Every order is someone&apos;s trade in transit.</h2>
      </div>

      <div className={styles.floatingAsymmetricGrid}>
        {galleryItems.map((item, idx) => {
          const moveX = prefersReducedMotion ? 0 : offset.x * item.depthFactor;
          const moveY = prefersReducedMotion ? 0 : offset.y * item.depthFactor;

          return (
            <motion.div
              animate={{ x: moveX, y: moveY }}
              className={`${styles.floatingGalleryCard} ${styles[`cardPosition_${idx}`]}`}
              key={item.id}
              tabIndex={0}
              transition={{ type: "spring", stiffness: 120, damping: 20 }}
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
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
