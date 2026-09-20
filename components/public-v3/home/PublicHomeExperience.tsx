"use client";

import { useRef } from "react";
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
import { useHomeNarrativeDirector } from "./director/useHomeNarrativeDirector";
import { PersistentActorLayer } from "../actors/PersistentActorLayer";
import type { MarketplaceCategoryItem } from "./scenes/MarketplaceFivePanelScene";
import { FIVE_PANEL_MEDIA } from "./scenes/MarketplaceFivePanelScene";

interface PublicHomeExperienceProps {
  isStorefrontExposed?: boolean;
  storefrontCategories?: MarketplaceCategoryItem[];
}

/** One measured media surface for the cargo-to-marketplace handoff. */
function TransitionLayer({ categories }: { categories: MarketplaceCategoryItem[] }) {
  const visibleCategories = categories.slice(0, 5);
  const first = visibleCategories[0] ?? FIVE_PANEL_MEDIA[0];

  return (
    <div
      data-motion="trailer-takeover"
      className="kt-trailer-takeover-plane pointer-events-none fixed inset-0 z-30 overflow-hidden"
      aria-hidden="true"
    >
      <div className="relative w-full h-full bg-[var(--kt-asphalt)]">
        <div className="takeover-progression-1 absolute inset-0">
          <Image src={first.image} alt="" fill sizes="100vw" preload className="object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-[var(--kt-asphalt)]/50 to-transparent" />
        </div>

        <div className="takeover-progression-3 absolute inset-0 flex">
          {visibleCategories.slice(0, 3).map((category, index) => (
            <div
              key={`takeover-3-${category.id}`}
              data-takeover-p3-panel={index}
              className="relative h-full border-r border-[#23272B] last:border-r-0 overflow-hidden"
            >
              <Image src={category.image} alt="" fill sizes="33vw" preload className="object-cover" />
              <div className="absolute inset-0 bg-black/25" />
            </div>
          ))}
        </div>

        <div className="takeover-progression-5 absolute inset-0 flex">
          {visibleCategories.map((category, index) => (
            <div
              key={`takeover-5-${category.id}`}
              data-takeover-p5-panel={index}
              className="relative h-full border-r border-[#23272B] last:border-r-0 overflow-hidden"
            >
              <Image src={category.image} alt="" fill sizes="20vw" preload={index >= 3} className="object-cover" />
              <div className="absolute inset-0 bg-black/25" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ChapterContentLayer({ children }: { children: React.ReactNode }) {
  return <div className="kt-chapter-content-layer relative z-10 flex flex-col w-full">{children}</div>;
}

/** Persistent public experience directed by one normalized scroll resolver. */
export function PublicHomeExperience({
  isStorefrontExposed = false,
  storefrontCategories = [],
}: PublicHomeExperienceProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const categoriesList = storefrontCategories.length > 0 ? storefrontCategories : FIVE_PANEL_MEDIA;
  const selectedMarketplaceMedia = categoriesList[categoriesList.length - 1] ?? FIVE_PANEL_MEDIA[0];

  useHomeNarrativeDirector({ rootRef: containerRef, categories: categoriesList });

  return (
    <div
      ref={containerRef}
      data-kt-motion-owned="director"
      className="kt-home-experience flex flex-col w-full relative bg-[var(--kt-freight-paper)]"
    >
      <div className="kt-environment-layer pointer-events-none absolute inset-0 z-0 bg-[var(--kt-freight-paper)]" aria-hidden="true" />
      <div className="kt-typography-layer pointer-events-none absolute inset-0 z-1 overflow-hidden" aria-hidden="true" />

      <PersistentActorLayer />
      <TransitionLayer categories={categoriesList} />

      <ChapterContentLayer>
        <HeroScene />
        <MarketplaceFivePanelScene
          isStorefrontExposed={isStorefrontExposed}
          categories={storefrontCategories}
        />
        <ImageFanScene
          selectedMedia={selectedMarketplaceMedia}
          marketplaceMedia={categoriesList.map(({ id, title, image, altText }) => ({ id, title, image, altText }))}
        />
        <PreparationScene />
        <CollectionScene />
        <CustodySplitScene />
        <RouteScene />
        <FreightScene />
        <ArrivalScene />
        <FinaleScene />
      </ChapterContentLayer>

      {process.env.NODE_ENV !== "production" ? (
        <aside
          data-kt-motion-debug
          hidden
          aria-hidden="true"
          className="kt-home-motion-debug"
        >
          KT cinematic director
        </aside>
      ) : null}
    </div>
  );
}
