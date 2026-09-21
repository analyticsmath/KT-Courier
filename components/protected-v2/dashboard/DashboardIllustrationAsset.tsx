"use client";

import React, { useState } from "react";
import Image from "next/image";
import { RouteQueueIllustration } from "@/components/protected-v2/illustrations/RouteQueueIllustration";
import { ParcelDeskIllustration } from "@/components/protected-v2/illustrations/ParcelDeskIllustration";
import { AccessBoundaryIllustration } from "@/components/protected-v2/illustrations/AccessBoundaryIllustration";
import { SecureLedgerIllustration } from "@/components/protected-v2/illustrations/SecureLedgerIllustration";
import styles from "./dashboard.module.css";

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
    let illustration: React.ReactNode;
    switch (role) {
      case "applicant":
        illustration = <AccessBoundaryIllustration className={styles.illustrationArt} />;
        break;
      case "promoter":
        illustration = <SecureLedgerIllustration className={styles.illustrationArt} />;
        break;
      case "customer":
      case "store":
        illustration = <ParcelDeskIllustration className={styles.illustrationArt} />;
        break;
      case "admin":
      case "driver":
      default:
        illustration = <RouteQueueIllustration className={styles.illustrationArt} />;
    }
    return <div className={`${styles.illustrationFrame} ${className}`}>{illustration}</div>;
  }

  return (
    <div className={`${styles.illustrationFrame} ${className}`}>
      <Image
        src={asset.src}
        alt={asset.alt}
        width={asset.width}
        height={asset.height}
        unoptimized
        className={styles.illustrationImage}
        sizes="(max-width: 639px) 120px, 180px"
        onError={() => setLoadError(true)}
        priority={false}
      />
    </div>
  );
}
