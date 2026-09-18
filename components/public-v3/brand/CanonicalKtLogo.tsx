"use client";

import Image from "next/image";

interface CanonicalKtLogoProps {
  className?: string;
  size?: number | "fill";
  priority?: boolean;
  alt?: string;
}

/**
 * Authoritative KT Couriers brand identity wrapper.
 * Directly renders the owner-supplied SVG identity from public/media/public/images/illustration/logo.svg.
 * Strictly preserves aspect ratio and original blue/red/black brand identity.
 */
export function CanonicalKtLogo({
  className = "",
  size = 48,
  priority = true,
  alt = "KT Couriers",
}: CanonicalKtLogoProps) {
  if (size === "fill") {
    return (
      <div className={`relative h-full w-full ${className}`}>
        <Image
          src="/media/public/images/illustration/logo.svg"
          alt={alt}
          fill
          priority={priority}
          sizes="120px"
          style={{ objectFit: "contain" }}
        />
      </div>
    );
  }

  return (
    <Image
      src="/media/public/images/illustration/logo.svg"
      alt={alt}
      width={size}
      height={size}
      priority={priority}
      className={`inline-block ${className}`}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        objectFit: "contain",
      }}
    />
  );
}
