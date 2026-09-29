"use client";

import { memo } from "react";
import { HeroVanSequenceActor } from "./HeroVanSequenceActor";

export const CINEMATIC_LAYER_Z = {
  environment: 0, chapterMedia: 10, backgroundType: 15, actorsStage: 20,
  physicalOccluders: 25, materialTakeover: 30, navigation: 50,
} as const;

/** The accepted Hero is the only remaining consumer of the historical actor stage. */
export const PersistentActorLayer = memo(function PersistentActorLayer() {
  return <div data-kt-actor-stage className="kt-cinematic-actor-stage pointer-events-none fixed left-0 right-0 bottom-0 overflow-hidden" aria-hidden="true" style={{ top: "var(--kt-header-height, 4rem)", zIndex: CINEMATIC_LAYER_Z.actorsStage }}>
    <div data-actor-slot="hero-van" className="kt-actor-slot kt-actor-slot-hero-van"><HeroVanSequenceActor /></div>
  </div>;
});
