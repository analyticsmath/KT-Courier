"use client";

import { useRef, useState, useCallback } from "react";
import Image from "next/image";
import { motion, useReducedMotion, useScroll, useSpring, useTransform } from "motion/react";
import type { StorefrontDocument } from "@/lib/storefront/storefront-types";
import styles from "./commerce.module.css";

type ProductMedia = NonNullable<StorefrontDocument["mediaGallery"]>[number];

interface ProductMediaGalleryProps {
  product: StorefrontDocument;
  mediaGallery: readonly ProductMedia[];
}

interface DesktopPdpMediaCardProps {
  media: ProductMedia;
  index: number;
  total: number;
  productTitle: string;
}

function DesktopPdpMediaCard({ media, index, total, productTitle }: DesktopPdpMediaCardProps) {
  const mediaRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  const hasValidDimensions = Number.isFinite(media.width) && media.width > 0 &&
    Number.isFinite(media.height) && media.height > 0;
  const imageWidth = hasValidDimensions ? media.width : 1;
  const imageHeight = hasValidDimensions ? media.height : 1;
  const ratio = imageWidth / imageHeight;

  const { scrollYProgress } = useScroll({
    target: mediaRef,
    offset: ["start 92%", "end 8%"],
  });
  const smoothProgress = useSpring(scrollYProgress, {
    stiffness: 120,
    damping: 28,
    mass: 0.45,
    restDelta: 0.001,
  });
  const scale = useTransform(smoothProgress, [0, 0.5, 1], reduceMotion ? [1, 1, 1] : [0.988, 1, 0.988]);
  const y = useTransform(smoothProgress, [0, 0.5, 1], reduceMotion ? [0, 0, 0] : [12, 0, -12]);
  const cardStyle = { "--pdp-media-ratio-number": ratio, scale, y };

  return (
    <motion.div
      className={styles.pdpDesktopMediaCard}
      ref={mediaRef}
      style={cardStyle}
    >
      <Image
        alt={media.alt || `${productTitle} - View ${index + 1}`}
        width={imageWidth}
        height={imageHeight}
        preload={index === 0}
        sizes="(max-width: 1199px) 55vw, (max-width: 1245px) 560px, (max-width: 1734px) 45vw, 780px"
        src={`/api/catalog/media/${media.publicReference}`}
        className={`${styles.pdpDesktopImage} ${hasValidDimensions ? "" : styles.pdpDesktopImageUnknownRatio}`}
      />
      {total > 1 && (
        <span className={styles.pdpDesktopMediaIndex} aria-hidden="true">
          {String(index + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
        </span>
      )}
    </motion.div>
  );
}

export function ProductMediaGallery({ product, mediaGallery }: ProductMediaGalleryProps) {
  const gallery = mediaGallery.length > 0
    ? mediaGallery
    : product.primaryMedia
      ? [product.primaryMedia]
      : [];

  const [activeIndex, setActiveIndex] = useState(0);
  const mobileScrollerRef = useRef<HTMLDivElement>(null);
  const isScrollingRef = useRef(false);

  const scrollToSlide = useCallback((index: number) => {
    setActiveIndex(index);
    if (mobileScrollerRef.current) {
      const target = mobileScrollerRef.current.children[index] as HTMLElement | undefined;
      if (target) {
        isScrollingRef.current = true;
        target.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
        setTimeout(() => {
          isScrollingRef.current = false;
        }, 400);
      }
    }
  }, []);

  const handleMobileScroll = useCallback(() => {
    if (isScrollingRef.current || !mobileScrollerRef.current) return;
    const scroller = mobileScrollerRef.current;
    const scrollLeft = scroller.scrollLeft;
    const slideWidth = scroller.clientWidth;
    if (slideWidth > 0) {
      const newIndex = Math.round(scrollLeft / slideWidth);
      if (newIndex >= 0 && newIndex < gallery.length && newIndex !== activeIndex) {
        setActiveIndex(newIndex);
      }
    }
  }, [gallery.length, activeIndex]);

  return (
    <section
      aria-label={`${product.title} image gallery`}
      className={styles.pdpGalleryRoot}
      data-kt-shared-target={`product-${product.productReference}`}
    >
      {/* Mobile Horizontal Snap Scroller */}
      <div className={styles.pdpMobileGalleryWrap}>
        <div
          ref={mobileScrollerRef}
          className={styles.pdpMobileGalleryScroller}
          onScroll={handleMobileScroll}
          aria-label={`${product.title} images`}
        >
          {gallery.length > 0 ? (
            gallery.map((media, index) => (
              <div
                key={media.publicReference || index}
                className={styles.pdpMobileGallerySlide}
                data-kt-cart-flight-source={index === activeIndex ? "product-media" : undefined}
              >
                <div className={styles.pdpMobileGalleryFrame}>
                  <Image
                    alt={media.alt || `${product.title} - View ${index + 1}`}
                    fill
                    preload={index === 0}
                    sizes="100vw"
                    src={`/api/catalog/media/${media.publicReference}`}
                    className={media.width > 0 && media.height > 0 && media.width / media.height < .8 ? styles.pdpImagePortrait : styles.pdpImageContain}
                  />
                </div>
              </div>
            ))
          ) : (
            <div className={styles.pdpMobileGallerySlide} data-kt-cart-flight-source="product-media">
              <div className={styles.pdpGalleryEmpty}>Image unavailable</div>
            </div>
          )}
        </div>

        {/* Mobile Page Dots & Counter */}
        {gallery.length > 1 && (
          <div className={styles.pdpMobileGalleryPagination}>
            <div className={styles.pdpMobileGalleryDots}>
              {gallery.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => scrollToSlide(i)}
                  className={`${styles.pdpMobileGalleryDot} ${i === activeIndex ? styles.pdpMobileGalleryDotActive : ""}`}
                  aria-label={`Go to slide ${i + 1}`}
                />
              ))}
            </div>
            <span className={styles.pdpMobileGalleryCounter}>
              {activeIndex + 1} / {gallery.length}
            </span>
          </div>
        )}
      </div>

      {/* Desktop scroll-gallery: every image remains in document flow. */}
      <div className={styles.pdpDesktopGalleryStage}>
        {gallery.length > 0 ? gallery.map((media, index) => (
          <figure
            className={styles.pdpDesktopHeroFrame}
            data-kt-cart-flight-source={index === 0 ? "product-media" : undefined}
            key={media.publicReference || index}
          >
            <DesktopPdpMediaCard
              media={media}
              index={index}
              total={gallery.length}
              productTitle={product.title}
            />
          </figure>
        )) : (
          <div className={`${styles.pdpDesktopHeroFrame} ${styles.pdpDesktopHeroEmpty}`} data-kt-cart-flight-source="product-media">
            <div className={styles.pdpGalleryEmpty}>Image unavailable</div>
          </div>
        )}
      </div>
    </section>
  );
}
