"use client";

import Image from "next/image";
import { FIVE_PANEL_MEDIA } from "./MarketplaceFivePanelScene";

export interface SelectedFanMedia {
  id: string;
  title: string;
  image: string;
  altText?: string;
}

interface ImageFanSceneProps {
  className?: string;
  selectedMedia?: SelectedFanMedia;
  marketplaceMedia?: SelectedFanMedia[];
}

type SupportCard = { id: string; title: string; image: string; altText?: string; fanX: number; fanRotation: number };

/** The selected rail item owns the center card; the other live categories become its four previews. */
export function ImageFanScene({ className = "", selectedMedia, marketplaceMedia = [] }: ImageFanSceneProps) {
  const source = marketplaceMedia.length ? marketplaceMedia.slice(0, 5) : FIVE_PANEL_MEDIA;
  const selected = source.find((media) => media.id === selectedMedia?.id) ?? source.at(-1)!;
  const supportOffsets = [-330, -165, 165, 330];
  const supportCards: SupportCard[] = source
    .filter((media) => media.id !== selected.id)
    .map((media, index) => {
      const fanX = supportOffsets[index] ?? (index < 2 ? -330 : 330);
      return {
        ...media,
        fanX,
        fanRotation: Math.sign(fanX) * (Math.abs(fanX) < 200 ? 6 : 12),
      };
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
            The selected marketplace category stays in the center as the surrounding categories fan out.
          </p>
        </div>

        <div
          data-motion="fan-stage"
          tabIndex={0}
          role="region"
          aria-label="Marketplace category selection"
          className="kt-fan-stage relative w-full max-w-6xl h-[70vh] flex justify-center items-center outline-none focus-visible:ring-1 focus-visible:ring-[var(--kt-brand-blue)]"
        >
          {supportCards.map((item, index) => (
            <article
              key={item.id}
              data-fan-support-id={item.id}
              className="kt-fan-card kt-fan-support-card absolute overflow-hidden z-10"
              style={{ transformOrigin: "bottom center" }}
              data-fan-index={index}
              data-fan-rot={item.fanRotation}
              data-fan-x={item.fanX}
              data-fan-y={Math.abs(item.fanX) > 200 ? 20 : 8}
              data-is-hero="false"
              aria-label={item.title}
            >
              <div className="relative w-full h-full bg-[#1A1E24]">
                <Image src={item.image} alt={item.altText || item.title} fill sizes="(max-width: 767px) 24vw, (max-width: 1439px) 25vw, 350px" loading="lazy" className="object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-[var(--kt-asphalt)]/90 via-transparent to-transparent" />
                <span className="absolute bottom-4 left-4 right-4 text-xs font-mono uppercase tracking-wider text-[var(--kt-concrete)]">{item.title}</span>
              </div>
            </article>
          ))}

          <article
            data-motion="fan-hero"
            data-home-occluder="fan-parcel-mask"
            data-fan-card-id={selected.id}
            data-fan-active="true"
            className="kt-fan-card kt-fan-hero-card absolute overflow-hidden z-20"
            style={{ transformOrigin: "bottom center" }}
            data-fan-index={supportCards.length}
            data-fan-rot="0"
            data-fan-x="0"
            data-fan-y="0"
            data-is-hero="true"
            aria-label={`Selected category: ${selected.title}`}
          >
            <div className="relative w-full h-full bg-[#1A1E24]">
              {source.map((media) => (
                <div
                  key={media.id}
                  className="kt-fan-selected-media-layer absolute inset-0"
                  data-fan-media-id={media.id}
                  data-fan-active={media.id === selected.id ? "true" : "false"}
                  aria-hidden="true"
                >
                  <Image
                    data-fan-selected-image={media.id}
                    src={media.image}
                    alt=""
                    fill
                    sizes="(max-width: 767px) 66vw, (max-width: 1439px) 30vw, 440px"
                    loading={media.id === selected.id ? "eager" : "lazy"}
                    className="object-cover"
                  />
                </div>
              ))}
              <div className="absolute inset-0 bg-gradient-to-t from-[var(--kt-asphalt)]/90 via-transparent to-transparent" />
              <div className="absolute bottom-4 left-4 right-4">
                <span data-fan-selected-label className="text-xs font-mono uppercase tracking-wider text-[var(--kt-concrete)]">{selected.title}</span>
              </div>
            </div>
          </article>
        </div>
        <div data-actor-anchor="fan-parcel-target" className="sr-only" aria-hidden="true" />
      </div>
    </section>
  );
}
