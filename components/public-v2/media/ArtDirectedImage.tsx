import type { CSSProperties } from "react";
import { getImageProps } from "next/image";
import { cn } from "@/lib/utils/cn";
import {
  assertPublicImageAccessibility,
  type ImageFetchPriority,
  type ImageLoading,
  type LocalPublicImageSource,
} from "./types";

export type ArtDirectedImageProps = {
  desktopSrc: LocalPublicImageSource;
  tabletSrc: LocalPublicImageSource;
  mobileSrc: LocalPublicImageSource;
  width: number;
  height: number;
  alt?: string;
  decorative?: boolean;
  priority?: boolean;
  fetchPriority?: ImageFetchPriority;
  loading?: ImageLoading;
  sizes: string;
  quality?: number;
  className?: string;
  imageClassName?: string;
  objectFit?: CSSProperties["objectFit"];
  objectPosition?: CSSProperties["objectPosition"];
  aspectRatio?: CSSProperties["aspectRatio"];
  mobileMedia?: string;
  tabletMedia?: string;
};

/**
 * Uses Next's image prop generation with a native picture element so separate
 * approved local assets can be art-directed by viewport without layout shift.
 */
export function ArtDirectedImage({
  desktopSrc,
  tabletSrc,
  mobileSrc,
  width,
  height,
  alt,
  decorative = false,
  priority = false,
  fetchPriority,
  loading,
  sizes,
  quality,
  className,
  imageClassName,
  objectFit = "cover",
  objectPosition,
  aspectRatio,
  mobileMedia = "(max-width: 639px)",
  tabletMedia = "(max-width: 1023px)",
}: ArtDirectedImageProps) {
  if (process.env.NODE_ENV !== "production" && priority && (loading || fetchPriority)) {
    throw new Error(
      "ArtDirectedImage: priority cannot be combined with loading or fetchPriority."
    );
  }

  const imageAlt = assertPublicImageAccessibility({
    alt,
    decorative,
    componentName: "ArtDirectedImage",
  });
  const imageStyle: CSSProperties = { objectFit, objectPosition };
  const effectiveLoading = priority ? "eager" : loading;
  const effectiveFetchPriority = priority ? "high" : fetchPriority;
  const imageProps = {
    alt: imageAlt,
    width,
    height,
    sizes,
    quality,
    loading: effectiveLoading,
    fetchPriority: effectiveFetchPriority,
    className: cn("kt-public-art-directed-image__image", imageClassName),
    style: imageStyle,
  };
  const { props: desktopProps } = getImageProps({ src: desktopSrc, ...imageProps });
  const { props: tabletProps } = getImageProps({ src: tabletSrc, ...imageProps });
  const { props: mobileProps } = getImageProps({ src: mobileSrc, ...imageProps });
  const wrapperStyle = aspectRatio ? { aspectRatio } : undefined;

  return (
    <div
      className={cn("kt-public-art-directed-image", className)}
      data-kt-public-has-aspect-ratio={aspectRatio ? "true" : undefined}
      style={wrapperStyle}
    >
      <picture>
        <source media={mobileMedia} sizes={mobileProps.sizes} srcSet={mobileProps.srcSet} />
        <source media={tabletMedia} sizes={tabletProps.sizes} srcSet={tabletProps.srcSet} />
        <img {...desktopProps} alt={imageAlt} aria-hidden={decorative || undefined} />
      </picture>
    </div>
  );
}
