"use client";

import { memo } from "react";
import type { SyntheticEvent } from "react";
import Image from "next/image";
import { markActorImageReady } from "../home/director/home-actor-image-readiness";
import {
  COURIER_STATES,
  RED_TRUCK_STATES,
  VAN_STATES,
  WHITE_TRUCK_STATES,
  HERO_TRUCK_SEQUENCE,
  type ActorStateDefinition,
} from "./actor-state-machine";

export const CINEMATIC_LAYER_Z = {
  environment: 0,
  chapterMedia: 10,
  backgroundType: 15,
  actorsStage: 20,
  physicalOccluders: 25,
  materialTakeover: 30,
  navigation: 50,
} as const;

const HOME_OCCLUDERS = [
  "parcel-mask",
  "custody-seam-mask",
  "route-overpass-a",
  "route-overpass-b",
  "route-terminal-mask",
  "freight-gate-mask",
] as const;

function handleActorImageLoad(event: SyntheticEvent<HTMLImageElement>) {
  markActorImageReady(event.currentTarget);
}

function StateBank({
  actor,
  states,
  preloadStates = [],
}: {
  actor: "white-truck" | "van" | "courier" | "red-truck";
  states: Record<string, ActorStateDefinition>;
  preloadStates?: string[];
}) {
  return (
    <>
      {Object.values(states).map((state) => {
        if (!state.webpSrc) return null;
        const preload = preloadStates.includes(state.id);
        return (
          <Image
            key={`${actor}:${state.id}`}
            data-actor-state-layer={state.id}
            data-actor-type={actor}
            src={state.webpSrc}
            alt=""
            fill
            sizes="100vw"
            loading={preload ? "eager" : "lazy"}
            fetchPriority={preload ? "high" : "low"}
            onLoad={handleActorImageLoad}
            className="kt-actor-state-layer"
            aria-hidden="true"
          />
        );
      })}
    </>
  );
}

/** Persistent, pre-rendered frame bank; the director selects layers without React rerenders. */
export const CinematicActorStage = memo(function CinematicActorStage() {
  return (
    <div
      data-kt-actor-stage
      className="kt-cinematic-actor-stage pointer-events-none fixed left-0 right-0 bottom-0 overflow-hidden"
      aria-hidden="true"
      style={{ top: "var(--kt-header-height, 4rem)", zIndex: CINEMATIC_LAYER_Z.actorsStage }}
    >
      <div data-actor-slot="white-truck" className="kt-actor-slot kt-actor-slot-white-truck">
        <StateBank
          actor="white-truck"
          states={{
            "front-3q-entry-phase-01": WHITE_TRUCK_STATES["front-3q-entry-phase-01"],
            "front-3q-entry-phase-02": WHITE_TRUCK_STATES["front-3q-entry-phase-02"],
            "front-3q-entry-phase-03": WHITE_TRUCK_STATES["front-3q-entry-phase-03"],
            "front-3q-entry-phase-04": WHITE_TRUCK_STATES["front-3q-entry-phase-04"],
            "front-3q-entry-phase-05": WHITE_TRUCK_STATES["front-3q-entry-phase-05"],
            "front-3q-entry-phase-06": WHITE_TRUCK_STATES["front-3q-entry-phase-06"],
            "front-center-transition-phase-01": WHITE_TRUCK_STATES["front-center-transition-phase-01"],
            "front-center-transition-phase-02": WHITE_TRUCK_STATES["front-center-transition-phase-02"],
            "true-front-center-full": WHITE_TRUCK_STATES["true-front-center-full"],
            "true-front-center-medium": WHITE_TRUCK_STATES["true-front-center-medium"],
            "true-front-center-close": WHITE_TRUCK_STATES["true-front-center-close"],
            "true-front-center-extreme-close": WHITE_TRUCK_STATES["true-front-center-extreme-close"],
            "top-down-straight": WHITE_TRUCK_STATES["top-down-straight"],
            "top-down-angled": WHITE_TRUCK_STATES["top-down-angled"],
            "top-down-turning": WHITE_TRUCK_STATES["top-down-turning"],
          }}
          preloadStates={[...HERO_TRUCK_SEQUENCE.slice(0, 6)]}
        />
      </div>

      <div data-actor-slot="van" className="kt-actor-slot kt-actor-slot-van">
        <StateBank
          actor="van"
          states={{
            "motion-transition": VAN_STATES["motion-transition"],
            "side-left": VAN_STATES["side-left"],
            "sliding-door-open": VAN_STATES["sliding-door-open"],
          }}
          preloadStates={[]}
        />
        <div data-van-door-aperture data-home-occluder="van-door-mask" aria-hidden="true">
          <Image
            src={VAN_STATES["sliding-door-open"].webpSrc}
            alt=""
            fill
            sizes="65vw"
            loading="lazy"
            className="kt-van-door-interior-layer"
          />
        </div>
      </div>

      <div data-actor-slot="courier" className="kt-actor-slot kt-actor-slot-courier">
        <StateBank
          actor="courier"
          states={{
            "look-left-approach": COURIER_STATES["look-left-approach"],
            "lift-parcel": COURIER_STATES["lift-parcel"],
            "loading-unloading": COURIER_STATES["loading-unloading"],
            "ready-handover": COURIER_STATES["ready-handover"],
            "walk-left-one-parcel": COURIER_STATES["walk-left-one-parcel"],
            "extending-handoff": COURIER_STATES["extending-handoff"],
          }}
          preloadStates={[]}
        />
      </div>

      <div data-actor-slot="red-truck" className="kt-actor-slot kt-actor-slot-red-truck">
        <StateBank
          actor="red-truck"
          states={{
            "motion-entry": RED_TRUCK_STATES["motion-entry"],
            "side-right": RED_TRUCK_STATES["side-right"],
            "centered-hero": RED_TRUCK_STATES["centered-hero"],
          }}
          preloadStates={[]}
        />
      </div>
      {HOME_OCCLUDERS.map((id) => (
        <div
          key={id}
          data-home-occluder={id}
          className={`kt-home-actor-occluder kt-home-occluder-${id}`}
          aria-hidden="true"
        />
      ))}
    </div>
  );
});
