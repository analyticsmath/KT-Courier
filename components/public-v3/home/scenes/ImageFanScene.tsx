"use client";

import Image from "next/image";
import { ktMediaV3 } from "../../media/kt-media-v3";

export interface SelectedFanMedia {
  id?: string;
  title: string;
  image: string;
  altText?: string;
}

interface ImageFanSceneProps {
  className?: string;
  selectedMedia?: SelectedFanMedia;
  marketplaceMedia?: SelectedFanMedia[];
}

export const BASE_FAN_ITEMS = [
  { id: "leather", asset: ktMediaV3.editorial.fashion.leatherBags, label: "Artisan Leather", rotation: -14, xOffset: -360, yOffset: 24 },
  { id: "market", asset: ktMediaV3.editorial.grocery.vegetablesCrate, label: "Fresh Market", rotation: -9, xOffset: -240, yOffset: 12 },
  { id: "kitchen", asset: ktMediaV3.editorial.food.grainBowl, label: "Local Kitchen", rotation: -4, xOffset: -120, yOffset: 4 },
  { id: "hero", asset: ktMediaV3.editorial.fashion.leatherBags, label: "Local Craft", rotation: 0, xOffset: 0, yOffset: 0, isHeroChoice: true },
  { id: "wellness", asset: ktMediaV3.editorial.wellness.apothecaryBottles, label: "Botanical Wellness", rotation: 4, xOffset: 120, yOffset: 4 },
  { id: "jewelry", asset: ktMediaV3.editorial.fashion.jewelry, label: "Handcrafted Jewelry", rotation: 9, xOffset: 240, yOffset: 12 },
  { id: "apparel", asset: ktMediaV3.editorial.fashion.whiteTop, label: "Boutique Apparel", rotation: 14, xOffset: 360, yOffset: 24 },
];

/**
 * The image fan is a continuation of the marketplace, not a new random gallery.
 * Live marketplace category photography fills the surrounding fan positions and
 * the selected marketplace image keeps ownership of the central card.
 */
export function ImageFanScene({
  className = "",
  selectedMedia,
  marketplaceMedia = [],
}: ImageFanSceneProps) {
  const surroundingMarketplaceMedia = marketplaceMedia.filter(
    (media) =>
      Boolean(media.image) &&
      (!selectedMedia?.id || media.id !== selectedMedia.id),
  );

  const fanItems = BASE_FAN_ITEMS.map((item, itemIndex) => {
    if (item.isHeroChoice && selectedMedia?.image) {
      return {
        ...item,
        asset: {
          src: selectedMedia.image,
          alt: selectedMedia.altText || selectedMedia.title,
        },
        label: selectedMedia.title,
      };
    }

    if (!item.isHeroChoice && surroundingMarketplaceMedia.length) {
      const surroundingPosition = BASE_FAN_ITEMS
        .slice(0, itemIndex)
        .filter((candidate) => !candidate.isHeroChoice).length;
      const media =
        surroundingMarketplaceMedia[
          surroundingPosition % surroundingMarketplaceMedia.length
        ];

      return {
        ...item,
        asset: {
          src: media.image,
          alt: media.altText || media.title,
        },
        label: media.title,
      };
    }

    return item;
  });

  return (
    <section
      className={`kt-image-fan-section relative min-h-[155vh] flex flex-col justify-center items-center overflow-hidden bg-[var(--kt-asphalt)] text-[var(--kt-freight-paper)] ${className}`}
      data-kt-contrast="dark"
      data-kt-scene="image-fan"
      aria-label="Selection to Parcel Transition"
      style={{ minHeight: "155svh" }}
    >
      <div className="kt-home-sticky-stage kt-home-fan-sticky">
        <div className="max-w-2xl mx-auto text-center px-6 relative z-10">
          <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight mb-3 text-[var(--kt-white)]">
            From shelf to parcel.
          </h2>
          <p className="text-sm sm:text-base text-[var(--kt-concrete)] leading-relaxed">
            From neighborhood craft workshops to curated shelves, items are carefully staged and sealed for transport.
          </p>
        </div>

        <div
          data-motion="fan-stage"
          tabIndex={0}
          role="region"
          aria-label="Image Fan Selection Stage"
          className="kt-fan-stage relative w-full max-w-6xl h-[70vh] flex justify-center items-center outline-none focus-visible:ring-1 focus-visible:ring-[var(--kt-brand-blue)]"
        >
          {fanItems.map((item, idx) => (
            <div
              key={item.id}
              data-motion={item.isHeroChoice ? "fan-hero" : undefined}
              className={`kt-fan-card absolute overflow-hidden ${item.isHeroChoice ? "kt-fan-hero-card z-20" : "z-10"}`}
              style={{ transformOrigin: "bottom center" }}
              data-fan-index={idx}
              data-fan-rot={item.rotation}
              data-fan-x={item.xOffset}
              data-fan-y={item.yOffset}
              data-is-hero={item.isHeroChoice ? "true" : "false"}
            >
              <div className="relative w-full h-full bg-[#1A1E24]">
                {item.isHeroChoice && marketplaceMedia.length ? marketplaceMedia.map((media) => (
                  <div
                    key={media.id || media.title}
                    className="kt-fan-selected-media-layer absolute inset-0"
                    data-fan-media-id={media.id}
                    data-fan-active={media.id === selectedMedia?.id ? "true" : "false"}
                    aria-hidden="true"
                  >
                    <Image
                      data-fan-selected-image={media.id}
                      src={media.image}
                      alt=""
                      fill
                      sizes="(max-width: 767px) 86vw, 62vw"
                      loading="lazy"
                      className="object-cover"
                    />
                  </div>
                )) : (
                  <Image
                    data-fan-selected-image={item.isHeroChoice ? "true" : undefined}
                    src={item.asset.src}
                    alt={item.asset.alt}
                    fill
                    sizes="(max-width: 767px) 86vw, 62vw"
                    loading="lazy"
                    className="object-cover"
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-[var(--kt-asphalt)]/80 via-transparent to-transparent" />
                {item.isHeroChoice ? (
                  <div className="absolute bottom-5 left-5 right-5">
                    <span data-fan-selected-label className="text-xs font-mono uppercase tracking-wider text-[var(--kt-concrete)]">
                      {item.label}
                    </span>
                  </div>
                ) : null}
              </div>
            </div>
          ))}
        </div>
        <div data-actor-anchor="fan-parcel-target" className="sr-only" aria-hidden="true" />
      </div>
    </section>
  );
}
