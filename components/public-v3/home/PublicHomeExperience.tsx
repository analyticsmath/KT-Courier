"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import {
  HeroScene,
  MarketplaceFivePanelScene,
  ImageFanScene,
  PreparationScene,
  CollectionScene,
  CustodySplitScene,
  RouteScene,
  FreightScene,
  ArrivalScene,
  FinaleScene,
} from "./scenes";
import { useMasterHomeTimeline } from "./MasterHomeTimeline";
import { PersistentActorLayer } from "../actors/PersistentActorLayer";
import { ktMediaV3 } from "../media/kt-media-v3";
import type {
  WhiteTruckStateId,
  VanStateId,
  CourierStateId,
  RedTruckStateId,
} from "../actors/actor-state-machine";
import type { MarketplaceCategoryItem } from "./scenes/MarketplaceFivePanelScene";

interface PublicHomeExperienceProps {
  isStorefrontExposed?: boolean;
  storefrontCategories?: MarketplaceCategoryItem[];
}

/**
 * Environment Layer.
 * Ambient environmental backdrop plane for warm paper texture and light continuity.
 */
function EnvironmentLayer() {
  return (
    <div
      className="kt-environment-layer pointer-events-none absolute inset-0 z-0 overflow-hidden bg-[var(--kt-freight-paper)]"
      aria-hidden="true"
    />
  );
}

/**
 * Typography Layer.
 * Monumental typographic depth plane behind actors.
 */
function TypographyLayer() {
  return (
    <div
      className="kt-typography-layer pointer-events-none absolute inset-0 z-1 overflow-hidden"
      aria-hidden="true"
    />
  );
}

/**
 * Transition Layer.
 * Owns physical material takeover and aperture reveals across chapters.
 * aria-hidden ensures visual continuity elements do not duplicate semantic screen reader content.
 */
function TransitionLayer() {
  const takeoverImg = ktMediaV3.editorial.fashion.brownCoat;

  return (
    <div
      className="kt-trailer-takeover-plane pointer-events-none fixed inset-0 z-30 overflow-hidden"
      aria-hidden="true"
      style={{ opacity: 0 }}
    >
      <div className="relative w-full h-full bg-[var(--kt-asphalt)]">
        <Image
          src={takeoverImg.src}
          alt=""
          fill
          sizes="100vw"
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--kt-asphalt)]/90 via-transparent to-transparent" />
      </div>
    </div>
  );
}

/**
 * Chapter Content Layer.
 * Contains the continuous narrative chapter sequence with scene layouts and measured actor anchors.
 */
function ChapterContentLayer({ children }: { children: React.ReactNode }) {
  return (
    <div className="kt-chapter-content-layer relative z-10 flex flex-col w-full">
      {children}
    </div>
  );
}

/**
 * PublicHomeExperience (v3).
 * Root architecture enforcing narrative actor continuity across 11 continuous chapters:
 * 1. EnvironmentLayer (Warm Freight Paper #F1ECE2 canvas)
 * 2. TypographyLayer (Monumental typographic scale)
 * 3. PersistentActorLayer (single mounted owner of White Truck, Van, Courier, and Red Truck)
 * 4. TransitionLayer (Material trailer takeover into commerce corridor)
 * 5. ChapterContentLayer (11 continuous narrative chapters)
 */
export function PublicHomeExperience({
  isStorefrontExposed = false,
  storefrontCategories = [],
}: PublicHomeExperienceProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Discrete narrative actor states (GSAP owns continuous spatial transforms)
  const [whiteTruckState, setWhiteTruckState] = useState<WhiteTruckStateId>("wide-hero");
  const [vanState, setVanState] = useState<VanStateId>("side-right");
  const [courierState, setCourierState] = useState<CourierStateId>("look-right-approach");
  const [redTruckState, setRedTruckState] = useState<RedTruckStateId>("centered-hero");
  const [activeActor, setActiveActor] = useState<"white-truck" | "van" | "courier" | "red-truck" | null>("white-truck");
  const [marketplaceActiveId, setMarketplaceActiveId] = useState<string>("fashion");

  // Master Experience Controller
  useMasterHomeTimeline({
    rootRef: containerRef,
    onWhiteTruckStateChange: setWhiteTruckState,
    onVanStateChange: setVanState,
    onCourierStateChange: setCourierState,
    onRedTruckStateChange: setRedTruckState,
    onActiveActorChange: setActiveActor,
    onMarketplaceActiveIdChange: setMarketplaceActiveId,
  });

  return (
    <div
      ref={containerRef}
      className="kt-home-experience flex flex-col w-full relative overflow-hidden bg-[var(--kt-freight-paper)]"
    >
      {/* 1. Ambient Environment Layer */}
      <EnvironmentLayer />

      {/* 2. Typographic Depth Layer */}
      <TypographyLayer />

      {/* 3. Persistent Actor Layer (Mounted ONCE, owns the four physical actors) */}
      <PersistentActorLayer
        whiteTruckState={whiteTruckState}
        vanState={vanState}
        courierState={courierState}
        redTruckState={redTruckState}
        activeActor={activeActor}
        isHero={activeActor === "white-truck" && whiteTruckState === "wide-hero"}
      />

      {/* 4. Cinematic Material Takeover & Transition Layer */}
      <TransitionLayer />

      {/* 5. Chapter Content Layer (Supplies narrative content and spatial layout anchors) */}
      <ChapterContentLayer>
        {/* Chapter 01: Hero & Brand Establish (Poster Still on Freight Paper) */}
        <HeroScene />

        {/* Chapter 02 & 03: Trailer Takeover into 5-Panel Marketplace Corridor */}
        <MarketplaceFivePanelScene
          isStorefrontExposed={isStorefrontExposed}
          categories={storefrontCategories}
          activeId={marketplaceActiveId}
          onActiveIdChange={setMarketplaceActiveId}
        />

        {/* Chapter 04: Perspective Image Fan (Choice -> Parcel Contraction) */}
        <ImageFanScene />

        {/* Chapter 05: Merchant Preparation & Corrugated Box Sealing */}
        <PreparationScene />

        {/* Chapter 06: Local Collection — Van Enters Closed -> Brakes -> Door Opens */}
        <CollectionScene />

        {/* Chapter 07: Custody Transfer Seam (72/28 -> 50/50 Dual Photography) */}
        <CustodySplitScene />

        {/* Chapter 08: Transit Route & Aerial Highway Plane */}
        <RouteScene />

        {/* Chapter 09: Heavy Freight Climax (Massive Red Truck & Terminal Scale) */}
        <FreightScene />

        {/* Chapter 10: Doorstep Arrival & Quiet Human Handoff */}
        <ArrivalScene />

        {/* Chapter 11: Finale Resolution & Narrow Geographic Ground Strip */}
        <FinaleScene />
      </ChapterContentLayer>
    </div>
  );
}
