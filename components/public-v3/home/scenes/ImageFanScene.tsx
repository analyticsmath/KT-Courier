"use client";

import Image from "next/image";
import { FIVE_PANEL_MEDIA } from "./MarketplaceFivePanelScene";
import styles from "../post-hero-scenes.module.css";
import { chapterBudgetVh, mobileChapterBudgetVh } from "../director/home-chapters";

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

type SupportCard = { id: string; title: string; image: string; altText?: string; fanSlot: string; fanRotation: number };

/** The selected rail item owns the center card; the other live categories become its four previews. */
export function ImageFanScene({ className = "", selectedMedia, marketplaceMedia = [] }: ImageFanSceneProps) {
  const source = marketplaceMedia.length ? marketplaceMedia.slice(0, 5) : FIVE_PANEL_MEDIA;
  const selected = source.find((media) => media.id === selectedMedia?.id) ?? source.at(-1)!;
  const supportSlots = ["far-left", "near-left", "near-right", "far-right"];
  const supportCards: SupportCard[] = source
    .filter((media) => media.id !== selected.id)
    .map((media, index) => {
      const fanSlot = supportSlots[index] ?? "far-right";
      return {
        ...media,
        fanSlot,
        fanRotation: fanSlot.includes("left") ? (fanSlot.includes("far") ? -22 : -13) : fanSlot.includes("far") ? 22 : 13,
      };
    });

  return (
    <section
      className={`${styles.fanSection} kt-image-fan-section ${className}`}
      data-kt-contrast="dark"
      data-kt-scene="image-fan"
      aria-label="Selection to Parcel Transition"
      style={{ "--kt-home-budget": chapterBudgetVh("fan"), "--kt-home-mobile-budget": mobileChapterBudgetVh("fan") } as React.CSSProperties}
    >
      <div className="kt-home-sticky-stage kt-home-fan-sticky">
        <div className={styles.fanHeading}>
          <h2>
            From shelf to parcel.
          </h2>
          <p>
            The selected marketplace category stays in the center as the surrounding categories fan out.
          </p>
        </div>

        <div
          data-motion="fan-stage"
          tabIndex={0}
          role="region"
          aria-label="Marketplace category selection"
          className={`${styles.fanStage} kt-fan-stage`}
        >
          {supportCards.map((item, index) => (
            <article
              key={item.id}
              data-fan-support-id={item.id}
              className={`${styles.fanCard} kt-fan-card kt-fan-support-card`}
              style={{ transformOrigin: "bottom center" }}
              data-fan-index={index}
              data-fan-rot={item.fanRotation}
              data-fan-slot={item.fanSlot}
              data-is-hero="false"
              aria-label={item.title}
            >
              <div className={styles.fanCardMedia}>
                <Image src={item.image} alt={item.altText || item.title} fill sizes="(max-width: 767px) 24vw, (max-width: 1439px) 25vw, 350px" loading="lazy" className="object-cover" />
                <div className={styles.fanMediaShade} />
                <span className={styles.fanCardLabel}>{item.title}</span>
              </div>
            </article>
          ))}

          <article
            data-motion="fan-hero"
            data-fan-card-id={selected.id}
            data-fan-active="true"
            className={`${styles.fanCard} ${styles.fanHeroCard} kt-fan-card kt-fan-hero-card`}
            style={{ transformOrigin: "bottom center" }}
            data-fan-index={supportCards.length}
            data-fan-rot="0"
            data-fan-slot="center"
            data-is-hero="true"
            aria-label={`Selected category: ${selected.title}`}
          >
            <div className={styles.fanCardMedia}>
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
              <div className={styles.fanMediaShade} />
              <div className={styles.fanHeroLabel}>
                <span data-fan-selected-label>{selected.title}</span>
              </div>
            </div>
          </article>
        </div>
        <div data-actor-anchor="fan-parcel-target" className="sr-only" aria-hidden="true" />
      </div>
    </section>
  );
}
