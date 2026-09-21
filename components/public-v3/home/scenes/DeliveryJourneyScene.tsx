"use client";

import Image from "next/image";
import type { CSSProperties } from "react";
import { ktMediaV3 } from "../../media/kt-media-v3";
import { POST_HERO_RESOLVER_ACTOR_STATES } from "../director/post-hero-frame-resolver";
import { chapterBudgetVh, mobileChapterBudgetVh } from "../director/home-chapters";
import { PostHeroActorBank } from "../actors/PostHeroActorSprite";
import styles from "../post-hero-scenes.module.css";

export function DeliveryJourneyScene({ className = "" }: { className?: string }) {
  const street = ktMediaV3.editorial.merchant.mabonengDepot;
  const routePlane = ktMediaV3.pages.homepage.routePlane;
  const custodyEvidence = ktMediaV3.pages.homepage.custodySplit.merchantSide;
  const style = {
    "--kt-home-budget": `${chapterBudgetVh("journey")}svh`,
    "--kt-home-mobile-budget": `${mobileChapterBudgetVh("journey")}svh`,
  } as CSSProperties;

  return (
    <section
      className={`${styles.journeySection} ${className}`}
      data-kt-contrast="light"
      data-kt-scene="journey"
      aria-labelledby="journey-heading"
      style={style}
    >
      <div className={styles.journeyStickyStage} data-home-sticky-stage>
        <div className={styles.journeyStreet}>
          <Image src={street.src} alt="" fill sizes="100vw" className="object-cover object-top" />
          <div className={styles.journeyStreetShade} />
        </div>
        <div className={styles.journeyGround} aria-hidden="true" />

        <div className={styles.journeyCopy}>
          <p>Collected by KT.</p>
          <h2 id="journey-heading">A careful handoff. A clear route.</h2>
        </div>

        <div className={styles.journeyRoad} data-journey-road aria-hidden="true">
          <Image src={routePlane.src} alt="" fill sizes="100vw" className="object-cover object-center" />
          <svg viewBox="0 0 1000 800" preserveAspectRatio="none">
            <path
              data-route-path
              d="M -40 610 C 110 680 190 520 330 500 C 470 480 455 360 520 270 C 595 165 730 175 1040 120"
              fill="none"
              stroke="#252a2e"
              strokeWidth="218"
              strokeLinecap="round"
            />
            <path
              d="M -40 610 C 110 680 190 520 330 500 C 470 480 455 360 520 270 C 595 165 730 175 1040 120"
              fill="none"
              stroke="rgba(241,236,226,.66)"
              strokeWidth="4"
              strokeDasharray="18 18"
              strokeLinecap="round"
            />
          </svg>
        </div>

        <PostHeroActorBank
          actor="van"
          scene="journey"
          states={POST_HERO_RESOLVER_ACTOR_STATES.filter((state) => state.startsWith("van:"))}
          className={styles.journeyVan}
        />
        <PostHeroActorBank
          actor="courier"
          scene="journey"
          states={POST_HERO_RESOLVER_ACTOR_STATES.filter((state) => state.startsWith("courier:") && !state.endsWith("extending-handoff"))}
          className={styles.journeyCourier}
        />
        <PostHeroActorBank
          actor="white-truck"
          scene="journey"
          states={POST_HERO_RESOLVER_ACTOR_STATES.filter((state) => state.startsWith("white-truck:"))}
          className={styles.journeyRouteTruck}
        />

        <aside className={styles.journeyCustody} data-journey-custody aria-hidden="true">
          <div>
            <Image src={custodyEvidence.src} alt="" fill sizes="(max-width: 767px) 72vw, 32vw" className="object-cover" />
          </div>
          <p>In KT custody.</p>
        </aside>
        <p className={styles.journeyRouteAnnotation} data-journey-route-annotation>On the way.</p>
      </div>
    </section>
  );
}
