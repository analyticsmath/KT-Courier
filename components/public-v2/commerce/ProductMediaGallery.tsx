"use client";

import { useRef, useState, useCallback } from "react";
import Image from "next/image";
import type { StorefrontDocument } from "@/lib/storefront/storefront-types";
import styles from "./commerce.module.css";

interface ProductMediaGalleryProps {
  product: StorefrontDocument;
  mediaGallery: readonly NonNullable<StorefrontDocument["mediaGallery"]>[number][];
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
      aria-label="Product image gallery"
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
                    priority={index === 0}
                    sizes="(max-width: 991px) 100vw, 58vw"
                    src={`/api/catalog/media/${media.publicReference}`}
                    className={styles.pdpImageContain}
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
          <div className={styles.pdpMobileGalleryPagination} aria-hidden="true">
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

      {/* Desktop media column: images scroll naturally while the purchase plane stays put. */}
      <div className={styles.pdpDesktopGalleryStage}>
        {gallery.length > 0 ? gallery.map((media, index) => (
          <div
            className={styles.pdpDesktopHeroFrame}
            data-kt-cart-flight-source={index === 0 ? "product-media" : undefined}
            key={media.publicReference || index}
          >
            <Image
              alt={media.alt || `${product.title} - View ${index + 1}`}
              fill
              priority={index === 0}
              sizes="(max-width: 991px) 100vw, 58vw"
              src={`/api/catalog/media/${media.publicReference}`}
              className={styles.pdpImageContain}
            />
          </div>
        )) : (
          <div className={styles.pdpDesktopHeroFrame} data-kt-cart-flight-source="product-media">
            <div className={styles.pdpGalleryEmpty}>Image unavailable</div>
          </div>
        )}
      </div>
    </section>
  );
}
