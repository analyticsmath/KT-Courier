"use client";

import { useCallback, useRef, useState } from "react";
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
import { HomeIntroCurtain } from "./HomeIntroCurtain";
import { PersistentStoryMediaLayer } from "./PersistentStoryMediaLayer";

interface PublicHomeExperienceProps {
  isStorefrontExposed?: boolean;
  storefrontCategories?: MarketplaceCategoryItem[];
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
  const [introResolved, setIntroResolved] = useState(false);
  const resolveIntro = useCallback(() => setIntroResolved(true), []);
  const categoriesList = storefrontCategories.length > 0 ? storefrontCategories : FIVE_PANEL_MEDIA;
  const [selectedMarketplaceId, setSelectedMarketplaceId] = useState(() => categoriesList[0]?.id ?? FIVE_PANEL_MEDIA[0].id);
  const selectedMarketplaceMedia = categoriesList.find(({ id }) => id === selectedMarketplaceId) ?? categoriesList[0] ?? FIVE_PANEL_MEDIA[0];

  useHomeNarrativeDirector({
    rootRef: containerRef,
    categories: categoriesList,
    enabled: introResolved,
    onMarketplaceSelectionChange: setSelectedMarketplaceId,
  });

  return (
    <div
      ref={containerRef}
      data-kt-motion-owned="director"
      className="kt-home-experience flex flex-col w-full relative bg-[var(--kt-freight-paper)]"
    >
      <div className="kt-environment-layer pointer-events-none absolute inset-0 z-0 bg-[var(--kt-freight-paper)]" aria-hidden="true" />
      <div className="kt-typography-layer pointer-events-none absolute inset-0 z-1 overflow-hidden" aria-hidden="true" />

      <PersistentActorLayer />
      <PersistentStoryMediaLayer items={categoriesList} />

      <ChapterContentLayer>
        <HeroScene />
        <MarketplaceFivePanelScene
          isStorefrontExposed={isStorefrontExposed}
          categories={categoriesList}
          selectedMarketplaceId={selectedMarketplaceId}
          onMarketplaceSelectionChange={setSelectedMarketplaceId}
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

      <div data-kt-motion-debug-geometry hidden aria-hidden="true">
        <div className="kt-home-debug-focus" />
        <div className="kt-home-debug-ground" />
        <div className="kt-home-debug-card-band" />
      </div>

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
      <HomeIntroCurtain onResolved={resolveIntro} />
    </div>
  );
}
