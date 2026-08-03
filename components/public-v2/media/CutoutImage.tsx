import type { CSSProperties } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils/cn";
import {
  assertPublicImageAccessibility,
  type ImageFetchPriority,
  type ImageLoading,
  type LocalPublicImageSource,
} from "./types";

export type CutoutImageProps = {
  src: LocalPublicImageSource;
  width: number;
  height: number;
  sizes: string;
  alt?: string;
  decorative?: boolean;
  priority?: boolean;
  fetchPriority?: ImageFetchPriority;
  loading?: ImageLoading;
  quality?: number;
  objectPosition?: CSSProperties["objectPosition"];
  className?: string;
  imageClassName?: string;
  groundShadow?: boolean;
};

/**
 * A stable transparent-image primitive for a future approved truck cutout.
 * It deliberately contains no parallax, reflection, or autonomous motion.
 */
export function CutoutImage({
  src,
  width,
  height,
  sizes,
  alt,
  decorative = false,
  priority = false,
  fetchPriority,
  loading,
  quality,
  objectPosition,
  className,
  imageClassName,
  groundShadow = false,
}: CutoutImageProps) {
  if (process.env.NODE_ENV !== "production" && priority && (loading || fetchPriority)) {
    throw new Error("CutoutImage: priority cannot be combined with loading or fetchPriority.");
  }

  const imageAlt = assertPublicImageAccessibility({
    alt,
    decorative,
    componentName: "CutoutImage",
  });

  return (
    <div className={cn("kt-public-cutout-image", className)}>
      {groundShadow ? <span aria-hidden="true" className="kt-public-cutout-image__shadow" /> : null}
      <Image
        alt={imageAlt}
        aria-hidden={decorative || undefined}
        className={cn("kt-public-cutout-image__image", imageClassName)}
        fetchPriority={fetchPriority}
        height={height}
        loading={loading}
        preload={priority}
        quality={quality}
        sizes={sizes}
        src={src}
        style={{ objectFit: "contain", objectPosition }}
        width={width}
      />
    </div>
  );
}
