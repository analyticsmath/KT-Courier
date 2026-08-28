"use client";

import { useEffect, useState } from "react";
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
  const [svgContent, setSvgContent] = useState<string | null>(null);

  useEffect(() => {
    if (!prefersReducedMotion) return;

    let active = true;
    fetch(src)
      .then((res) => (res.ok ? res.text() : null))
      .then((text) => {
        if (!active || !text) return;
        // Strip animation tags and pause CSS animations for deterministic still frame
        const staticSvg = text
          .replace(/<animate[\s\S]*?\/>/gi, "")
          .replace(/<animateTransform[\s\S]*?\/>/gi, "")
          .replace(/<animateMotion[\s\S]*?\/>/gi, "")
          .replace(
            /<svg([^>]*)>/i,
            '<svg$1><style>*, *::before, *::after { animation: none !important; animation-play-state: paused !important; transition: none !important; }</style>'
          );
        setSvgContent(staticSvg);
      })
      .catch(() => {
        // graceful fallback to standard image
      });

    return () => {
      active = false;
    };
  }, [src, prefersReducedMotion]);

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
        width,
        height,
      }}
    >
      {prefersReducedMotion && svgContent ? (
        <div
          dangerouslySetInnerHTML={{ __html: svgContent }}
          style={{ width: "100%", height: "100%", display: "contents" }}
        />
      ) : (
        <Image
          alt={decorative ? "" : alt}
          height={height}
          src={src}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
          }}
          unoptimized
          width={width}
        />
      )}
    </div>
  );
}
