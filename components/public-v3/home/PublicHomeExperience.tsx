"use client";

import { useRef, useState } from "react";
import Image from "next/image";
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
import { PersistentActorLayer } from "../actors/PersistentActorLayer";
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
 * Ambient environmental backdrop plane for paper, texture, and light continuity.
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
  return (
    <div
      className="kt-trailer-takeover-plane pointer-events-none fixed inset-0 z-30 overflow-hidden"
      aria-hidden="true"
      style={{ opacity: 0 }}
    >
      <div className="relative w-full h-full bg-[var(--kt-asphalt)]">
        <Image
          src="/media/public/images/jhb-fashion-brown-coat.webp"
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
 * Contains the narrative chapter sequence with scene layouts and measured actor anchors.
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
 * Root architecture enforcing narrative actor continuity:
 * 1. EnvironmentLayer
 * 2. TypographyLayer
 * 3. PersistentActorLayer (single mounted owner of White Truck, Van, Courier, and Red Truck)
 * 4. TransitionLayer (Material takeover transition)
 * 5. ChapterContentLayer (Narrative chapters with measured scene anchors)
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
      className="kt-home-experience flex flex-col w-full relative overflow-hidden"
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
        {/* Chapter 01: Hero & Brand Establish */}
        <HeroScene />

        {/* Chapter 02: Commerce Discovery — 5-Panel Marketplace Field */}
        <MarketplaceFivePanelScene
          isStorefrontExposed={isStorefrontExposed}
          categories={storefrontCategories}
          activeId={marketplaceActiveId}
          onActiveIdChange={setMarketplaceActiveId}
        />

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
      </ChapterContentLayer>
    </div>
  );
}
