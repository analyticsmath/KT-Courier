"use client";

import { useCallback, useRef, useState } from "react";
import { HeroScene } from "./scenes/HeroScene";
import { CommerceWorldScene } from "./scenes/CommerceWorldScene";
import { ParcelizationScene } from "./scenes/ParcelizationScene";
import { NetworkRouteScene } from "./scenes/NetworkRouteScene";
import { FreightTransitionScene } from "./scenes/FreightTransitionScene";
import { LastMileDeliveryScene } from "./scenes/LastMileDeliveryScene";
import { ArrivalFinaleScene } from "./scenes/ArrivalFinaleScene";
import { useHomeNarrativeDirector } from "./director/useHomeNarrativeDirector";
import { PersistentActorLayer } from "../actors/PersistentActorLayer";
import { HomeIntroCurtain } from "./HomeIntroCurtain";
import { PersistentPostHeroCinematicLayer } from "./actors/PersistentPostHeroCinematicLayer";
import type { HomepageStorefrontPresentation } from "./data/home-storefront-presentation";

interface PublicHomeExperienceProps {
  isStorefrontExposed?: boolean;
  storefrontPresentation?: HomepageStorefrontPresentation | null;
}

export function PublicHomeExperience({ isStorefrontExposed = false, storefrontPresentation }: PublicHomeExperienceProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [introResolved, setIntroResolved] = useState(false);
  const resolveIntro = useCallback(() => setIntroResolved(true), []);
  const presentation = storefrontPresentation ?? { categories: [], stores: [], products: [] };
  const [selectedCategoryId, setSelectedCategoryId] = useState(presentation.categories[0]?.id);
  const [selectedStoreId, setSelectedStoreId] = useState(presentation.stores[0]?.id);
  const [selectedProductId, setSelectedProductId] = useState(presentation.products[0]?.id);
  useHomeNarrativeDirector({ rootRef: containerRef, categories: presentation.categories, stores: presentation.stores, products: presentation.products, enabled: introResolved, onMarketplaceSelectionChange: setSelectedCategoryId, onStoreSelectionChange: setSelectedStoreId, onProductSelectionChange: setSelectedProductId });
  const selectedProduct = presentation.products.find((product) => product.id === selectedProductId) ?? presentation.products[0];

  return <div ref={containerRef} data-kt-motion-owned="director" data-storefront-exposed={isStorefrontExposed} className="kt-home-experience flex flex-col w-full relative bg-[var(--kt-freight-paper)]">
    <div className="kt-environment-layer pointer-events-none absolute inset-0 z-0 bg-[var(--kt-freight-paper)]" aria-hidden="true" />
    <div className="kt-typography-layer pointer-events-none absolute inset-0 z-1 overflow-hidden" aria-hidden="true" />
    <PersistentActorLayer />
    {introResolved ? <PersistentPostHeroCinematicLayer /> : null}
    <div className="kt-chapter-content-layer relative z-10 flex flex-col w-full">
      <HeroScene />
      <CommerceWorldScene categories={presentation.categories} stores={presentation.stores} products={presentation.products} selectedCategoryId={selectedCategoryId} onCategorySelectionChange={setSelectedCategoryId} selectedStoreId={selectedStoreId} onStoreSelectionChange={setSelectedStoreId} selectedProductId={selectedProductId} onProductSelectionChange={setSelectedProductId} />
      <ParcelizationScene product={selectedProduct} />
      <NetworkRouteScene />
      <FreightTransitionScene />
      <LastMileDeliveryScene />
      <ArrivalFinaleScene />
    </div>
    {process.env.NODE_ENV !== "production" ? <aside data-kt-motion-debug hidden aria-hidden="true" className="fixed bottom-3 left-3 z-[60] max-w-[min(90vw,32rem)] bg-black/80 px-3 py-2 font-mono text-[11px] leading-tight text-white" /> : null}
    <HomeIntroCurtain onResolved={resolveIntro} />
  </div>;
}
