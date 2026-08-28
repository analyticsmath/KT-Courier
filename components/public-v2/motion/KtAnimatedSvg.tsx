"use client";

import Image from "next/image";
import { usePublicMotionPreference } from "./usePublicMotionPreference";

interface KtAnimatedSvgProps {
  src: string;
  alt?: string;
  className?: string;
  width?: number;
  height?: number;
  decorative?: boolean;
}

export function KtAnimatedSvg({
  src,
  alt = "",
  className = "",
  width = 64,
  height = 64,
  decorative = true,
}: KtAnimatedSvgProps) {
  const { prefersReducedMotion } = usePublicMotionPreference();

  return (
    <div
      aria-hidden={decorative ? true : undefined}
      aria-label={decorative ? undefined : alt}
      className={`kt-animated-svg-container ${className}`}
      role={decorative ? "presentation" : "img"}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      <Image
        alt={decorative ? "" : alt}
        height={height}
        src={src}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "contain",
          animationPlayState: prefersReducedMotion ? "paused" : "running",
        }}
        unoptimized
        width={width}
      />
    </div>
  );
}
