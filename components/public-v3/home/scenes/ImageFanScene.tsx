"use client";

import { useRef, useEffect } from "react";
import Image from "next/image";
import gsap from "gsap";
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
}

export const BASE_FAN_ITEMS = [
  {
    id: "leather",
    asset: ktMediaV3.editorial.fashion.leatherBags,
    label: "Artisan Leather",
    rotation: -14,
    xOffset: -160,
    yOffset: 24,
  },
  {
    id: "market",
    asset: ktMediaV3.editorial.grocery.vegetablesCrate,
    label: "Fresh Market",
    rotation: -9,
    xOffset: -100,
    yOffset: 12,
  },
  {
    id: "kitchen",
    asset: ktMediaV3.editorial.food.grainBowl,
    label: "Local Kitchen",
    rotation: -4,
    xOffset: -45,
    yOffset: 4,
  },
  {
    id: "hero",
    asset: ktMediaV3.editorial.fashion.leatherBags,
    label: "Local Craft",
    rotation: 0,
    xOffset: 0,
    yOffset: 0,
    isHeroChoice: true,
  },
  {
    id: "wellness",
    asset: ktMediaV3.editorial.wellness.apothecaryBottles,
    label: "Botanical Wellness",
    rotation: 4,
    xOffset: 45,
    yOffset: 4,
  },
  {
    id: "jewelry",
    asset: ktMediaV3.editorial.fashion.jewelry,
    label: "Handcrafted Jewelry",
    rotation: 9,
    xOffset: 100,
    yOffset: 12,
  },
  {
    id: "apparel",
    asset: ktMediaV3.editorial.fashion.whiteTop,
    label: "Boutique Apparel",
    rotation: 14,
    xOffset: 160,
    yOffset: 24,
  },
];

/**
 * Chapter 4 — Perspective Image Fan (Choice -> Parcel Transition).
 * Displays a perspective fan of authentic local commerce items.
 * The central hero card strictly inherits the active Marketplace media (Amendment 3).
 * Initial geometry is owned by GSAP; CSS transform transitions are removed.
 * As scroll advances, the fan compresses, aligns, and contracts
 * toward parcel dimensions in PreparationScene.
 */
export function ImageFanScene({ className = "", selectedMedia }: ImageFanSceneProps) {
  const stageRef = useRef<HTMLDivElement>(null);

  const fanItems = BASE_FAN_ITEMS.map((item) => {
    if (item.isHeroChoice && selectedMedia) {
      return {
        ...item,
        asset: {
          src: selectedMedia.image,
          alt: selectedMedia.altText || selectedMedia.title,
        },
        label: selectedMedia.title,
      };
    }
    return item;
  });

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || typeof window === "undefined") return;

    // Check fine pointer (mouse / trackpad)
    const hasFinePointer = window.matchMedia("(pointer: fine)").matches;
    if (!hasFinePointer) return;

    const cards = Array.from(stage.querySelectorAll<HTMLElement>(".kt-fan-card"));
    if (cards.length === 0) return;

    const handlePointerMove = (e: PointerEvent) => {
      const rect = stage.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const dx = (e.clientX - centerX) / (rect.width / 2);
      const dy = (e.clientY - centerY) / (rect.height / 2);
      const clampedX = Math.max(-1, Math.min(1, dx));
      const clampedY = Math.max(-1, Math.min(1, dy));

      cards.forEach((card) => {
        const isHero = card.getAttribute("data-is-hero") === "true";
        const baseRot = parseFloat(card.getAttribute("data-fan-rot") || "0");
        const baseX = parseFloat(card.getAttribute("data-fan-x") || "0");
        const baseY = parseFloat(card.getAttribute("data-fan-y") || "0");
        const idx = parseInt(card.getAttribute("data-fan-index") || "3", 10);
        const distFromHero = Math.abs(idx - 3);

        let microX = 0;
        let microY = 0;
        let microRot = 0;

        if (isHero) {
          microX = clampedX * 12;
          microY = clampedY * 12;
          microRot = clampedX * 1.5;
        } else if (distFromHero === 1) {
          microX = clampedX * 8;
          microY = clampedY * 8;
          microRot = clampedX * 1.0;
        } else {
          microX = clampedX * 4;
          microY = clampedY * 4;
          microRot = clampedX * 0.5;
        }

        gsap.to(card, {
          x: baseX + microX,
          y: baseY + microY,
          rotation: baseRot + microRot,
          duration: 0.35,
          ease: "power2.out",
          overwrite: "auto",
        });
      });
    };

    const handlePointerLeave = () => {
      cards.forEach((card) => {
        const baseRot = parseFloat(card.getAttribute("data-fan-rot") || "0");
        const baseX = parseFloat(card.getAttribute("data-fan-x") || "0");
        const baseY = parseFloat(card.getAttribute("data-fan-y") || "0");

        gsap.to(card, {
          x: baseX,
          y: baseY,
          rotation: baseRot,
          duration: 0.4,
          ease: "power2.out",
          overwrite: "auto",
        });
      });
    };

    stage.addEventListener("pointermove", handlePointerMove);
    stage.addEventListener("pointerleave", handlePointerLeave);

    return () => {
      stage.removeEventListener("pointermove", handlePointerMove);
      stage.removeEventListener("pointerleave", handlePointerLeave);
    };
  }, []);

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
      <div
        ref={stageRef}
        className="kt-fan-stage relative w-full max-w-4xl h-[420px] sm:h-[480px] flex justify-center items-center"
      >
        {fanItems.map((item, idx) => {
          return (
            <div
              key={item.id}
              className={`kt-fan-card absolute overflow-hidden ${
                item.isHeroChoice ? "kt-fan-hero-card z-20" : "z-10"
              }`}
              style={{
                width: "min(68vw, 280px)",
                height: "min(92vw, 380px)",
                transformOrigin: "bottom center",
              }}
              data-fan-index={idx}
              data-fan-rot={item.rotation}
              data-fan-x={item.xOffset}
              data-fan-y={item.yOffset}
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
                {/* Reduced label density: dominant hero label only */}
                {item.isHeroChoice && (
                  <div className="absolute bottom-3 left-3 right-3">
                    <span className="text-[11px] font-mono uppercase tracking-wider text-[var(--kt-concrete)]">
                      {item.label}
                    </span>
                  </div>
                )}
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
