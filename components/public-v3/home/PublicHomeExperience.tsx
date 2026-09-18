"use client";

import { useRef } from "react";
import {
  HeroScene,
  MarketplaceFivePanelScene,
  PreparationScene,
  CollectionScene,
  CustodySplitScene,
  RouteScene,
  FreightScene,
  ArrivalScene,
  FinaleScene,
} from "./scenes";
import { useMasterHomeTimeline } from "./MasterHomeTimeline";

/**
 * PublicHomeExperience (v3).
 * Represents the complete cinematic delivery narrative:
 * Commerce becomes a parcel, the parcel becomes movement,
 * movement becomes a route, and the route ends in a human handoff.
 * Coordinated via useMasterHomeTimeline across 5 linked chapters.
 */
export function PublicHomeExperience() {
  const containerRef = useRef<HTMLDivElement>(null);

  // Bind master experience controller
  useMasterHomeTimeline({ rootRef: containerRef });

  return (
    <div
      ref={containerRef}
      className="kt-home-experience flex flex-col w-full relative"
    >
      {/* Chapter 01: Hero & Brand Establish (Immediate first view) */}
      <HeroScene />

      {/* Chapter 02: Commerce Discovery — 5-Panel Marketplace Field */}
      <MarketplaceFivePanelScene />

      {/* Chapter 03: Choice → Parcel Preparation */}
      <PreparationScene />

      {/* Chapter 04: Local Collection — Van & Courier */}
      <CollectionScene />

      {/* Chapter 05: Custody Transfer Seam */}
      <CustodySplitScene />

      {/* Chapter 06: Transit Route & Verified Information Architecture */}
      <RouteScene />

      {/* Chapter 07: Heavy Freight Network Climax */}
      <FreightScene />

      {/* Chapter 08: Doorstep Arrival & Physical Handoff */}
      <ArrivalScene />

      {/* Chapter 09: Finale Resolution */}
      <FinaleScene />
    </div>
  );
}
