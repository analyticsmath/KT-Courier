"use client";

import React, { useState } from "react";
import Image from "next/image";
import { RouteQueueIllustration } from "@/components/protected-v2/illustrations/RouteQueueIllustration";
import { ParcelDeskIllustration } from "@/components/protected-v2/illustrations/ParcelDeskIllustration";
import { AccessBoundaryIllustration } from "@/components/protected-v2/illustrations/AccessBoundaryIllustration";
import { SecureLedgerIllustration } from "@/components/protected-v2/illustrations/SecureLedgerIllustration";

export type DashboardIllustrationRole = "admin" | "customer" | "driver" | "store" | "promoter" | "applicant";

const ROLE_ILLUSTRATION_MAP: Record<DashboardIllustrationRole, { src: string; alt: string; width: number; height: number }> = {
  admin: {
    src: "/media/public/illustrations/alghozy-Kgy_OpyLu-I-unsplash.svg",
    alt: "Operations command centre fleet and logistics",
    width: 320,
    height: 220,
  },
  customer: {
    src: "/media/public/illustrations/kt-ill-package-receive.svg",
    alt: "Customer receiving courier parcel delivery",
    width: 320,
    height: 220,
  },
  driver: {
    src: "/media/public/illustrations/rifky-nur-setyadi-kDI32HrG0iw-unsplash.svg",
    alt: "Courier driver dispatch run and vehicle checklist",
    width: 320,
    height: 220,
  },
  store: {
    src: "/media/public/illustrations/kt-ill-online-shopping.svg",
    alt: "Merchant store fulfillment and packaging",
    width: 320,
    height: 220,
  },
  promoter: {
    src: "/media/public/illustrations/kt-ill-security.svg",
    alt: "Promoter partner financial ledger security",
    width: 320,
    height: 220,
  },
  applicant: {
    src: "/media/public/illustrations/rifky-nur-setyadi-q_4m_HhfhLs-unsplash.svg",
    alt: "Courier candidate application and onboarding",
    width: 320,
    height: 220,
  },
};

export function DashboardIllustrationAsset({
  role,
  className = "",
  preferSvg = false,
}: {
  role: DashboardIllustrationRole;
  className?: string;
  preferSvg?: boolean;
}) {
  const [loadError, setLoadError] = useState(false);
  const asset = ROLE_ILLUSTRATION_MAP[role];

  // If preferSvg or if primary illustration failed to load, fall back to the guaranteed static SVG illustration components
  if (preferSvg || loadError) {
    switch (role) {
      case "applicant":
        return <AccessBoundaryIllustration className={`w-full max-w-[200px] h-auto ${className}`} />;
      case "promoter":
        return <SecureLedgerIllustration className={`w-full max-w-[200px] h-auto ${className}`} />;
      case "customer":
      case "store":
        return <ParcelDeskIllustration className={`w-full max-w-[220px] h-auto ${className}`} />;
      case "admin":
      case "driver":
      default:
        return <RouteQueueIllustration className={`w-full max-w-[220px] h-auto ${className}`} />;
    }
  }

  return (
    <div className={`relative flex items-center justify-center overflow-hidden ${className}`}>
      <Image
        src={asset.src}
        alt={asset.alt}
        width={asset.width}
        height={asset.height}
        unoptimized
        className="w-full h-auto max-h-[180px] object-contain pointer-events-none select-none"
        sizes="(max-width: 640px) 140px, 220px"
        onError={() => setLoadError(true)}
        priority={false}
      />
    </div>
  );
}
