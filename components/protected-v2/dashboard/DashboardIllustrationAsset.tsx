"use client";

import React, { useState } from "react";
import Image from "next/image";
import { RouteQueueIllustration } from "@/components/protected-v2/illustrations/RouteQueueIllustration";
import { ParcelDeskIllustration } from "@/components/protected-v2/illustrations/ParcelDeskIllustration";
import { AccessBoundaryIllustration } from "@/components/protected-v2/illustrations/AccessBoundaryIllustration";
import { SecureLedgerIllustration } from "@/components/protected-v2/illustrations/SecureLedgerIllustration";

export type DashboardIllustrationRole = "admin" | "customer" | "driver" | "store" | "promoter" | "applicant";

const ROLE_PNG_MAP: Record<DashboardIllustrationRole, { src: string; alt: string; width: number; height: number }> = {
  admin: {
    src: "/media/public/images/KT_Courier_20_Transparent_PNG_Assets/16_empty_hands_courier_hero.png",
    alt: "Operations command centre courier",
    width: 320,
    height: 380,
  },
  customer: {
    src: "/media/public/images/KT_Courier_20_Transparent_PNG_Assets/07_ready_to_handover_parcel.png",
    alt: "Courier handing over parcel",
    width: 320,
    height: 380,
  },
  driver: {
    src: "/media/public/images/KT_Courier_20_Transparent_PNG_Assets/10_looking_right_approaching_vehicle.png",
    alt: "Courier driver on dispatch route",
    width: 320,
    height: 380,
  },
  store: {
    src: "/media/public/images/KT_Courier_20_Transparent_PNG_Assets/12_placing_parcel_down.png",
    alt: "Preparing parcels for store collection",
    width: 320,
    height: 380,
  },
  promoter: {
    src: "/media/public/images/KT_Courier_20_Transparent_PNG_Assets/19_half_body_holding_parcel.png",
    alt: "Promoter partner courier connection",
    width: 320,
    height: 380,
  },
  applicant: {
    src: "/media/public/images/KT_Courier_20_Transparent_PNG_Assets/01_original_pose_refined.png",
    alt: "Courier candidate application",
    width: 320,
    height: 380,
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
  const asset = ROLE_PNG_MAP[role];

  // If preferSvg or if raster asset failed to load, fall back to the guaranteed static SVG illustration components
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
        className="object-contain max-h-[180px] w-auto pointer-events-none select-none"
        sizes="(max-width: 640px) 140px, 200px"
        onError={() => setLoadError(true)}
        priority={false}
      />
    </div>
  );
}
