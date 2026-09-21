"use client";

import Image from "next/image";
import { ktMediaV3 } from "../../media/kt-media-v3";
import { chapterBudgetVh, mobileChapterBudgetVh } from "../director/home-chapters";
import styles from "../post-hero-scenes.module.css";

interface ArrivalSceneProps {
  className?: string;
}

/**
 * Chapter 10 — Arrival & Physical Handoff.
 * Heavy mechanical scale drops quickly to a quiet, human doorstep delivery.
 * Real doorstep documentary photography establishes the destination environment
 * behind the persistent Courier actor.
 */
export function ArrivalScene({ className = "" }: ArrivalSceneProps) {
  const doorstepBg = ktMediaV3.pages.homepage.arrival.background;

  return (
    <section
      className={`${styles.arrivalSection} ${className}`}
      data-kt-contrast="light"
      data-kt-scene="arrival"
      data-motion="arrival-world"
      aria-labelledby="arrival-heading"
      style={{ "--kt-home-budget": chapterBudgetVh("arrival"), "--kt-home-mobile-budget": mobileChapterBudgetVh("arrival") } as React.CSSProperties}
    >
      <div className="kt-home-sticky-stage kt-home-arrival-sticky">
      {/* Real Doorstep Documentary Backdrop */}
      <div className={styles.arrivalBackdrop}>
        <Image
          src={doorstepBg.src}
          alt={doorstepBg.alt}
          fill
          sizes="100vw"
          className="object-cover object-center filter grayscale"
        />
        <div className={styles.arrivalBackdropShade} />
      </div>

      <div className={styles.arrivalComposition}>
        <div className={styles.arrivalCopy}>
          <h2
            id="arrival-heading"
            className=""
          >
            Delivered.
          </h2>
          <p>
            The final proof is simple: a person, a doorstep, and the order safely in hand.
          </p>
        </div>

        {/* Courier Anchor geometry for persistent Courier actor */}
        <div className={styles.arrivalActorPlane}>
          <div
            data-actor-anchor="arrival-courier"
            className="w-64 sm:w-80 lg:w-96 min-h-[320px] flex items-center justify-center pointer-events-none"
          />
        </div>
      </div>
      <div data-motion="arrival-footer-title" className={styles.arrivalFinaleBridge} aria-hidden="true">
        <span>KT</span><span>COURIER</span>
      </div>
      </div>
    </section>
  );
}
