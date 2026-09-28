"use client";

import { useRef, useState, useCallback, useEffect } from "react";
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
  const thumbnailRailRef = useRef<HTMLDivElement>(null);
  const scrollFrameRef = useRef<number | null>(null);
  const isScrollingRef = useRef(false);
  useEffect(() => () => { if (scrollFrameRef.current !== null) cancelAnimationFrame(scrollFrameRef.current); }, []);
  useEffect(() => {
    if (gallery.length > 5) thumbnailRailRef.current?.children[activeIndex]?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [activeIndex, gallery.length]);

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
    if (scrollFrameRef.current !== null) return;
    scrollFrameRef.current = requestAnimationFrame(() => {
      scrollFrameRef.current = null;
      const scroller = mobileScrollerRef.current;
      if (scroller && scroller.clientWidth > 0) {
        const newIndex = Math.round(scroller.scrollLeft / scroller.clientWidth);
        if (newIndex >= 0 && newIndex < gallery.length) setActiveIndex((current) => current === newIndex ? current : newIndex);
      }
    });
  }, [gallery.length]);

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
                    className={media.width > 0 && media.height > 0 && media.width / media.height > 1.2 ? styles.pdpImageCover : styles.pdpImagePortrait}
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

        {/* Real-image thumbnail navigation and secondary counter. */}
        {gallery.length > 1 && (
          <div className={styles.pdpMobileGalleryPagination}>
            <div className={styles.pdpMobileThumbnailRail} data-overflow={gallery.length > 5 ? "true" : undefined} ref={thumbnailRailRef}>
              {gallery.map((media, i) => (
                <button
                  key={media.publicReference || i}
                  type="button"
                  onClick={() => scrollToSlide(i)}
                  className={`${styles.pdpMobileThumbnail} ${i === activeIndex ? styles.pdpMobileThumbnailActive : ""}`}
                  aria-label={`Show product image ${i + 1} of ${gallery.length}`}
                  aria-current={i === activeIndex ? "true" : undefined}
                ><Image alt="" fill sizes="58px" src={`/api/catalog/media/${media.publicReference}`} /></button>
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
