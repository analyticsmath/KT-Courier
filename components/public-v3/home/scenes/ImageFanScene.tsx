"use client";

import Image from "next/image";
import { ktMediaV3 } from "../../media/kt-media-v3";

interface ImageFanSceneProps {
  className?: string;
}

const FAN_ITEMS = [
  {
    asset: ktMediaV3.editorial.fashion.leatherBags,
    label: "Artisan Leather",
    rotation: -14,
    xOffset: -160,
    yOffset: 24,
  },
  {
    asset: ktMediaV3.editorial.grocery.vegetablesCrate,
    label: "Fresh Market",
    rotation: -9,
    xOffset: -100,
    yOffset: 12,
  },
  {
    asset: ktMediaV3.editorial.food.grainBowl,
    label: "Local Kitchen",
    rotation: -4,
    xOffset: -45,
    yOffset: 4,
  },
  {
    asset: ktMediaV3.editorial.ceramics.sculpturalVessel,
    label: "Ceramic Studio",
    rotation: 0,
    xOffset: 0,
    yOffset: 0,
    isHeroChoice: true,
  },
  {
    asset: ktMediaV3.editorial.wellness.apothecaryBottles,
    label: "Botanical Wellness",
    rotation: 4,
    xOffset: 45,
    yOffset: 4,
  },
  {
    asset: ktMediaV3.editorial.fashion.jewelry,
    label: "Handcrafted Jewelry",
    rotation: 9,
    xOffset: 100,
    yOffset: 12,
  },
  {
    asset: ktMediaV3.editorial.fashion.whiteTop,
    label: "Boutique Apparel",
    rotation: 14,
    xOffset: 160,
    yOffset: 24,
  },
];

/**
 * Chapter 4 — Perspective Image Fan (Choice -> Parcel Transition).
 * Displays a perspective fan of 7 authentic local commerce items.
 * As scroll advances, the fan compresses, aligns, and contracts
 * toward parcel dimensions, executing the physical metamorphosis from
 * merchant browsing to packed courier cargo.
 */
export function ImageFanScene({ className = "" }: ImageFanSceneProps) {
  return (
    <section
      className={`kt-image-fan-section relative min-h-[90vh] flex flex-col justify-center items-center py-20 overflow-hidden bg-[var(--kt-asphalt)] text-[var(--kt-freight-paper)] ${className}`}
      data-kt-contrast="dark"
      data-kt-scene="image-fan"
      aria-label="Selection to Parcel Transition"
    >
      <div className="max-w-xl mx-auto text-center px-6 mb-12 relative z-10">
        <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight mb-3 text-[var(--kt-white)]">
          From shelf to parcel.
        </h2>
        <p className="text-sm sm:text-base text-[var(--kt-concrete)] leading-relaxed">
          From neighborhood craft workshops to curated shelves, items are carefully staged and sealed for transport.
        </p>
      </div>

      {/* Fan Aperture Stage */}
      <div className="kt-fan-stage relative w-full max-w-4xl h-[420px] sm:h-[480px] flex justify-center items-center">
        {FAN_ITEMS.map((item, idx) => {
          return (
            <div
              key={item.asset.id}
              className={`kt-fan-card absolute overflow-hidden transition-transform duration-500 ease-out ${
                item.isHeroChoice ? "kt-fan-hero-card z-20" : "z-10"
              }`}
              style={{
                width: "min(68vw, 280px)",
                height: "min(92vw, 380px)",
                transform: `translateX(${item.xOffset}px) translateY(${item.yOffset}px) rotate(${item.rotation}deg)`,
                transformOrigin: "bottom center",
              }}
              data-fan-index={idx}
              data-is-hero={item.isHeroChoice ? "true" : "false"}
            >
              <div className="relative w-full h-full bg-[#1A1E24]">
                <Image
                  src={item.asset.src}
                  alt={item.asset.alt}
                  fill
                  sizes="320px"
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[var(--kt-asphalt)]/90 via-transparent to-transparent" />
                <div className="absolute bottom-3 left-3 right-3">
                  <span className="text-[11px] font-mono uppercase tracking-wider text-[var(--kt-concrete)]">
                    {item.label}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Ground Anchor Target */}
      <div
        data-actor-anchor="fan-parcel-target"
        className="w-32 h-24 pointer-events-none opacity-0 mt-8"
        aria-hidden="true"
      />
    </section>
  );
}
