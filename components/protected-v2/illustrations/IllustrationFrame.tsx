"use client";

import Image from "next/image";
import { useState } from "react";
import { ParcelDeskIllustration } from "./ParcelDeskIllustration";
import { RouteQueueIllustration } from "./RouteQueueIllustration";
import { AccessBoundaryIllustration } from "./AccessBoundaryIllustration";
import styles from "./illustration-frame.module.css";

export type DashboardIllustrationRole = "customer" | "store" | "driver" | "promoter" | "applicant" | "admin";
const assets = {
  customer: { file: "customer-delivery", width: 640, height: 360, alt: "A parcel handoff" },
  store: { file: "store-fulfilment", width: 480, height: 360, alt: "Preparing parcels for collection" },
  driver: { file: "driver-route", width: 480, height: 360, alt: "A courier preparing for a route" },
  promoter: { file: "promoter-growth", width: 480, height: 360, alt: "People sharing a connection" },
  applicant: { file: "applicant-journey", width: 480, height: 360, alt: "Preparing for the next career step" },
  admin: { file: "operations-network", width: 640, height: 360, alt: "" },
} as const;

/** Owner-provided local assets only. The line drawing remains on load failure. */
export function IllustrationFrame({ role, assetAvailable = false }: { role: DashboardIllustrationRole; assetAvailable?: boolean }) {
  const [failed, setFailed] = useState(false);
  const asset = assets[role];
  return <div className={styles.frame} style={{ aspectRatio: `${asset.width} / ${asset.height}` }}>
    {assetAvailable && !failed ? <Image src={`/images/dashboard/${asset.file}.webp`} alt={asset.alt} width={asset.width} height={asset.height} sizes="(max-width: 767px) 140px, 240px" onError={() => setFailed(true)} /> : role === "applicant" ? <AccessBoundaryIllustration /> : role === "driver" || role === "admin" || role === "promoter" ? <RouteQueueIllustration /> : <ParcelDeskIllustration />}
  </div>;
}
