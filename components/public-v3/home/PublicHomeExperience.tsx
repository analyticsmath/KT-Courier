"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { HeroScene } from "./scenes/HeroScene";
import { CommerceWorldScene, ParcelizationScene, NetworkRouteScene, FreightTransitionScene, LastMileDeliveryScene, ArrivalFinaleScene } from "./scenes/HomeCinematicScenes";
import { CollectionPickupScene } from "./scenes/CollectionPickupScene";
import { useHomeCinematicDirector } from "./director/useHomeCinematicDirector";
import { PersistentActorLayer } from "../actors/PersistentActorLayer";
import { HomeIntroCurtain } from "./HomeIntroCurtain";
import { PersistentHomeCinematicLayer } from "./actors/PersistentHomeCinematicLayer";
import { PersistentProductCarryLayer } from "./actors/PersistentProductCarryLayer";
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
  const [selectedProductId, setSelectedProductId] = useState(presentation.products[0]?.id);
  const handleProductSelectionChange = useCallback((id: string) => {
    setSelectedProductId(id);
    try {
      window.sessionStorage.setItem("kt-home-selected-product", id);
    } catch {
      // Storage can be unavailable in privacy-restricted browser contexts.
    }
  }, []);
  useEffect(() => {
    let restoreTimer: number | undefined;
    try {
      const storedId = window.sessionStorage.getItem("kt-home-selected-product");
      if (storedId && presentation.products.slice(0, 5).some((product) => product.id === storedId)) {
        restoreTimer = window.setTimeout(() => setSelectedProductId(storedId), 0);
      }
    } catch {
      // Storage can be unavailable in privacy-restricted browser contexts.
    }
    return () => {
      if (restoreTimer !== undefined) window.clearTimeout(restoreTimer);
    };
  }, [presentation.products]);
  useHomeCinematicDirector({ rootRef: containerRef, categories: presentation.categories, products: presentation.products, selectedProductId, enabled: introResolved, onMarketplaceSelectionChange: setSelectedCategoryId });
  const selectedProduct = presentation.products.find((product) => product.id === selectedProductId) ?? presentation.products[0];

  return <div ref={containerRef} data-kt-motion-owned="director" data-storefront-exposed={isStorefrontExposed} className="kt-home-experience flex flex-col w-full relative bg-[var(--kt-public-canvas)]">
    <div className="kt-environment-layer pointer-events-none absolute inset-0 z-0 bg-[var(--kt-public-canvas)]" aria-hidden="true" />
    <div className="kt-typography-layer pointer-events-none absolute inset-0 z-1 overflow-hidden" aria-hidden="true" />
    <PersistentActorLayer />
    {introResolved ? <PersistentHomeCinematicLayer /> : null}
    <PersistentProductCarryLayer product={selectedProduct} />
    <div className="kt-chapter-content-layer relative flex flex-col w-full">
      <HeroScene />
      <CommerceWorldScene categories={presentation.categories} products={presentation.products} selectedCategoryId={selectedCategoryId} onCategorySelectionChange={setSelectedCategoryId} selectedProductId={selectedProductId} onProductSelectionChange={handleProductSelectionChange} />
      <ParcelizationScene product={selectedProduct} />
      <CollectionPickupScene />
      <NetworkRouteScene />
      <FreightTransitionScene />
      <LastMileDeliveryScene />
      <ArrivalFinaleScene />
    </div>
    {process.env.NODE_ENV !== "production" ? <aside data-kt-motion-debug hidden aria-hidden="true" className="fixed bottom-3 left-3 z-[60] max-w-[min(90vw,32rem)] bg-[var(--kt-public-surface-inverse)]/80 px-3 py-2 font-mono text-[11px] leading-tight text-[var(--kt-public-text-inverse)]" /> : null}
    <HomeIntroCurtain onResolved={resolveIntro} />
  </div>;
}
