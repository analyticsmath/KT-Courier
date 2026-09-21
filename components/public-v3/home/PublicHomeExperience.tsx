"use client";

import { useCallback, useRef, useState } from "react";
import { HeroScene } from "./scenes/HeroScene";
import { MarketplaceExitTransitionLayer, MarketplaceFivePanelScene, FIVE_PANEL_MEDIA, type MarketplaceCategoryItem } from "./scenes/MarketplaceFivePanelScene";
import { PreparationScene } from "./scenes/PreparationScene";
import { DeliveryJourneyScene } from "./scenes/DeliveryJourneyScene";
import { FreightNetworkScene } from "./scenes/FreightNetworkScene";
import { ArrivalFinaleScene } from "./scenes/ArrivalFinaleScene";
import { useHomeNarrativeDirector } from "./director/useHomeNarrativeDirector";
import { PersistentActorLayer } from "../actors/PersistentActorLayer";
import { HomeIntroCurtain } from "./HomeIntroCurtain";
import { PersistentPostHeroCinematicLayer } from "./actors/PersistentPostHeroCinematicLayer";

interface PublicHomeExperienceProps {
  isStorefrontExposed?: boolean;
  storefrontCategories?: MarketplaceCategoryItem[];
}

function ChapterContentLayer({ children }: { children: React.ReactNode }) {
  return <div className="kt-chapter-content-layer relative z-10 flex flex-col w-full">{children}</div>;
}

/** The accepted Hero followed by the five grouped post-Hero worlds. */
export function PublicHomeExperience({
  isStorefrontExposed = false,
  storefrontCategories = [],
}: PublicHomeExperienceProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [introResolved, setIntroResolved] = useState(false);
  const resolveIntro = useCallback(() => setIntroResolved(true), []);
  const categories = storefrontCategories.length > 0 ? storefrontCategories : FIVE_PANEL_MEDIA;
  const [selectedMarketplaceId, setSelectedMarketplaceId] = useState(() => categories[0]?.id ?? FIVE_PANEL_MEDIA[0].id);

  useHomeNarrativeDirector({
    rootRef: containerRef,
    categories,
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
      {introResolved ? <PersistentPostHeroCinematicLayer /> : null}

      <ChapterContentLayer>
        <HeroScene />
        <MarketplaceFivePanelScene
          isStorefrontExposed={isStorefrontExposed}
          categories={categories}
          selectedMarketplaceId={selectedMarketplaceId}
          onMarketplaceSelectionChange={setSelectedMarketplaceId}
        />
        <PreparationScene />
        <DeliveryJourneyScene />
        <FreightNetworkScene />
        <ArrivalFinaleScene />
      </ChapterContentLayer>

      <MarketplaceExitTransitionLayer categories={categories} selectedMarketplaceId={selectedMarketplaceId} />

      <div data-kt-motion-debug-geometry hidden aria-hidden="true">
        <div className="kt-home-debug-focus" />
        <div className="kt-home-debug-ground" />
        <div className="kt-home-debug-card-band" />
      </div>

      {process.env.NODE_ENV !== "production" ? (
        <aside data-kt-motion-debug hidden aria-hidden="true" className="kt-home-motion-debug">
          KT cinematic director
        </aside>
      ) : null}
      <HomeIntroCurtain onResolved={resolveIntro} />
    </div>
  );
}
