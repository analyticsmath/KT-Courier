"use client";

import { HERO_VAN_FRAMES } from "../home/director/hero-van-sequence.generated";

/** Registered representation bank. The home director owns loading and all motion. */
export function HeroVanSequenceActor() {
  return <>
    {HERO_VAN_FRAMES.map((frame, index) => {
      const critical = index < 4 || index === HERO_VAN_FRAMES.length - 1;
      return <picture key={frame.id} className="kt-hero-van-picture">
        <source media="(max-width: 767px)" srcSet={critical ? frame.mobileSrc : undefined} data-hero-mobile-src={frame.mobileSrc} />
        {/* Direct picture sources select one preprocessed WebP per viewport; the director decodes frames on demand. */}
        <img
          data-actor-state-layer={frame.id}
          data-hero-frame-index={index}
          data-hero-yaw={frame.yaw}
          data-hero-desktop-src={frame.desktopSrc}
          src={critical ? frame.desktopSrc : undefined}
          alt=""
          aria-hidden="true"
          draggable={false}
          decoding="async"
          fetchPriority={critical ? "high" : "low"}
          className="kt-actor-state-layer"
        />
      </picture>;
    })}
  </>;
}
