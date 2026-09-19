/**
 * KT Courier Public Experience — Actor State Machine
 *
 * Strongly typed definitions for all 62 pre-rendered performance states.
 * Authoritative dimensions and ground contact baselines generated from local PNG masters via sharp.
 * Enforces orientation continuity, intrinsic ratios, and concealment rules.
 * Visible crossfades in unobstructed viewports are strictly forbidden.
 */

import {
  GENERATED_ACTOR_STATES,
  VAN_DOOR_CALIBRATION,
  type GeneratedActorState,
  type ConcealmentStrategy,
} from "./generated-actor-media";

export { VAN_DOOR_CALIBRATION, type GeneratedActorState, type ConcealmentStrategy };

export type ActorDirection =
  | "left"
  | "right"
  | "front"
  | "rear"
  | "top-down"
  | "turning"
  | "detail"
  | "center";

export type ActorAction =
  | "idle"
  | "approach"
  | "travel"
  | "accelerate"
  | "brake"
  | "open"
  | "load"
  | "handoff"
  | "turn"
  | "depart"
  | "carry";

export interface ActorStateDefinition {
  id: string;
  name: string;
  webpSrc: string;
  alt: string;
  width: number;
  height: number;
  aspectRatio: number;
  orientation: "right" | "left" | "center" | "top-down" | "detail";
  direction: ActorDirection;
  action: ActorAction;
  family: string;
  groundContact: {
    x: number;
    y: number;
    source?: "automatic" | "human-audited";
  };
  validPreviousStates?: string[];
  validNextStates?: string[];
  requiredOcclusion?: ConcealmentStrategy;
  allowedTransitionsIn?: string[];
  allowedTransitionsOut?: string[];
  concealment: ConcealmentStrategy;
}

function resolveGeneratedState(
  actorType: "white-truck" | "van" | "courier" | "red-truck",
  id: string,
  meta: {
    alt: string;
  }
): ActorStateDefinition {
  const gen: GeneratedActorState | undefined = GENERATED_ACTOR_STATES[`${actorType}:${id}`];
  if (!gen) {
    throw new Error(
      `[ActorStateMachine] Fatal: Authoritative generated state missing for "${actorType}:${id}". Fail-closed invariant violated.`
    );
  }

  const orientation: "right" | "left" | "center" | "top-down" | "detail" =
    gen.direction === "top-down" || gen.direction === "turning"
      ? "top-down"
      : gen.direction === "detail"
      ? "detail"
      : gen.direction === "left"
      ? "left"
      : gen.direction === "right"
      ? "right"
      : "center";

  return {
    id,
    name: gen.sourceFile.replace(/\.[^.]+$/, ""),
    webpSrc: gen.webpSrc,
    alt: meta.alt,
    width: gen.width,
    height: gen.height,
    aspectRatio: gen.aspectRatio,
    orientation,
    direction: gen.direction,
    action: gen.action,
    family: gen.family,
    groundContact: gen.groundContact,
    validPreviousStates: gen.validPreviousStates,
    validNextStates: gen.validNextStates,
    requiredOcclusion: gen.requiredOcclusion,
    allowedTransitionsIn: gen.validPreviousStates,
    allowedTransitionsOut: gen.validNextStates,
    concealment: gen.requiredOcclusion,
  };
}

// ---------------------------------------------------------------------------
// White Truck — 16 States (Flagship Long-Haul Transport)
// ---------------------------------------------------------------------------
export type WhiteTruckStateId =
  | "wide-hero" // 10: Primary campaign hero composition
  | "side-right" // 01
  | "side-left" // 02
  | "centered-hero" // 03: Settled profile hold
  | "front-3q-right" // 04
  | "front-3q-left" // 05
  | "rear-3q-right" // 06
  | "rear-3q-left" // 07
  | "top-down-straight" // 08
  | "top-down-angled" // 09
  | "front-cab-close" // 11
  | "cargo-box-close" // 12
  | "rear-portion-close" // 13
  | "rear-doors-open" // 14
  | "motion-energy" // 15: Acceleration state
  | "top-down-turning"; // 16

export const WHITE_TRUCK_STATES: Record<WhiteTruckStateId, ActorStateDefinition> = {
  "wide-hero": resolveGeneratedState("white-truck", "wide-hero", {
    alt: "KT Couriers white freight truck hero profile across typography",
  }),
  "side-right": resolveGeneratedState("white-truck", "side-right", {
    alt: "KT Couriers white truck full side view facing right",
  }),
  "side-left": resolveGeneratedState("white-truck", "side-left", {
    alt: "KT Couriers white truck full side view facing left",
  }),
  "centered-hero": resolveGeneratedState("white-truck", "centered-hero", {
    alt: "KT Couriers white truck centered side hold",
  }),
  "front-3q-right": resolveGeneratedState("white-truck", "front-3q-right", {
    alt: "KT Couriers white truck front three quarter view right",
  }),
  "front-3q-left": resolveGeneratedState("white-truck", "front-3q-left", {
    alt: "KT Couriers white truck front three quarter view left",
  }),
  "rear-3q-right": resolveGeneratedState("white-truck", "rear-3q-right", {
    alt: "KT Couriers white truck rear three quarter view right",
  }),
  "rear-3q-left": resolveGeneratedState("white-truck", "rear-3q-left", {
    alt: "KT Couriers white truck rear three quarter view left",
  }),
  "top-down-straight": resolveGeneratedState("white-truck", "top-down-straight", {
    alt: "KT Couriers white truck overhead top down route view",
  }),
  "top-down-angled": resolveGeneratedState("white-truck", "top-down-angled", {
    alt: "KT Couriers white truck angled top down approach",
  }),
  "front-cab-close": resolveGeneratedState("white-truck", "front-cab-close", {
    alt: "KT Couriers white truck driver cab close crop",
  }),
  "cargo-box-close": resolveGeneratedState("white-truck", "cargo-box-close", {
    alt: "KT Couriers white truck cargo box side panel",
  }),
  "rear-portion-close": resolveGeneratedState("white-truck", "rear-portion-close", {
    alt: "KT Couriers white truck cargo rear door close crop",
  }),
  "rear-doors-open": resolveGeneratedState("white-truck", "rear-doors-open", {
    alt: "KT Couriers white truck rear cargo doors slightly open",
  }),
  "motion-energy": resolveGeneratedState("white-truck", "motion-energy", {
    alt: "KT Couriers white truck accelerating into motion",
  }),
  "top-down-turning": resolveGeneratedState("white-truck", "top-down-turning", {
    alt: "KT Couriers white truck turning along highway curve",
  }),
};

// ---------------------------------------------------------------------------
// Courier — 20 States (Human Protagonist)
// ---------------------------------------------------------------------------
export type CourierStateId =
  | "walk-right-one-parcel" // 04
  | "walk-left-one-parcel" // 05
  | "look-right-approach" // 10
  | "look-left-approach" // 11
  | "lift-parcel" // 13
  | "place-parcel" // 12
  | "loading-unloading" // 18
  | "ready-handover" // 07
  | "extending-handoff" // 08
  | "look-viewer-parcel" // 09
  | "portrait-upper-body" // 20
  | "hero-standing" // 01
  | "full-body-one-parcel" // 02
  | "full-body-two-parcels" // 03
  | "walk-two-parcels" // 06
  | "small-parcel-one-hand" // 14
  | "medium-box-arm" // 15
  | "empty-hands-hero" // 16
  | "forward-gesture" // 17
  | "half-body-holding"; // 19

export const COURIER_STATES: Record<CourierStateId, ActorStateDefinition> = {
  "walk-right-one-parcel": resolveGeneratedState("courier", "walk-right-one-parcel", {
    alt: "KT courier carrying package walking right",
  }),
  "walk-left-one-parcel": resolveGeneratedState("courier", "walk-left-one-parcel", {
    alt: "KT courier carrying package walking left",
  }),
  "look-right-approach": resolveGeneratedState("courier", "look-right-approach", {
    alt: "KT courier approaching delivery vehicle looking right",
  }),
  "look-left-approach": resolveGeneratedState("courier", "look-left-approach", {
    alt: "KT courier approaching delivery vehicle looking left",
  }),
  "lift-parcel": resolveGeneratedState("courier", "lift-parcel", {
    alt: "KT courier lifting packed parcel",
  }),
  "place-parcel": resolveGeneratedState("courier", "place-parcel", {
    alt: "KT courier setting package down at delivery point",
  }),
  "loading-unloading": resolveGeneratedState("courier", "loading-unloading", {
    alt: "KT courier staging parcel into vehicle",
  }),
  "ready-handover": resolveGeneratedState("courier", "ready-handover", {
    alt: "KT courier holding parcel ready for custody transfer",
  }),
  "extending-handoff": resolveGeneratedState("courier", "extending-handoff", {
    alt: "KT courier extending parcel forward for doorstep handover",
  }),
  "look-viewer-parcel": resolveGeneratedState("courier", "look-viewer-parcel", {
    alt: "KT courier standing with parcel looking toward camera",
  }),
  "portrait-upper-body": resolveGeneratedState("courier", "portrait-upper-body", {
    alt: "KT courier portrait close crop",
  }),
  "hero-standing": resolveGeneratedState("courier", "hero-standing", {
    alt: "KT courier standing confident hero pose",
  }),
  "full-body-one-parcel": resolveGeneratedState("courier", "full-body-one-parcel", {
    alt: "KT courier full body standing with box",
  }),
  "full-body-two-parcels": resolveGeneratedState("courier", "full-body-two-parcels", {
    alt: "KT courier holding two boxes",
  }),
  "walk-two-parcels": resolveGeneratedState("courier", "walk-two-parcels", {
    alt: "KT courier walking with two delivery parcels",
  }),
  "small-parcel-one-hand": resolveGeneratedState("courier", "small-parcel-one-hand", {
    alt: "KT courier holding small package in one hand",
  }),
  "medium-box-arm": resolveGeneratedState("courier", "medium-box-arm", {
    alt: "KT courier holding medium box under arm",
  }),
  "empty-hands-hero": resolveGeneratedState("courier", "empty-hands-hero", {
    alt: "KT courier ready standing hero",
  }),
  "forward-gesture": resolveGeneratedState("courier", "forward-gesture", {
    alt: "KT courier gesturing forward with box",
  }),
  "half-body-holding": resolveGeneratedState("courier", "half-body-holding", {
    alt: "KT courier half body carrying delivery",
  }),
};

// ---------------------------------------------------------------------------
// Van — 14 States (Local Urban Collection & Street Movement)
// ---------------------------------------------------------------------------
export type VanStateId =
  | "side-right" // 01
  | "side-left" // 02: Primary base profile for collection
  | "front-3q-right" // 03
  | "front-3q-left" // 04
  | "rear-3q-right" // 05
  | "rear-3q-left" // 06
  | "centered-hero" // 07
  | "front-half-close" // 08
  | "rear-half-close" // 09
  | "sliding-door-open" // 10: Calibrated cargo door aperture (facing left)
  | "rear-doors-open" // 11
  | "all-doors-open" // 12
  | "motion-transition"; // 13: Arriving transition (facing left)

export const VAN_STATES: Record<VanStateId, ActorStateDefinition> = {
  "side-right": resolveGeneratedState("van", "side-right", {
    alt: "KT Couriers local delivery van side view facing right",
  }),
  "side-left": resolveGeneratedState("van", "side-left", {
    alt: "KT Couriers delivery van side view facing left",
  }),
  "front-3q-right": resolveGeneratedState("van", "front-3q-right", {
    alt: "KT Couriers van front 3/4 view facing right",
  }),
  "front-3q-left": resolveGeneratedState("van", "front-3q-left", {
    alt: "KT Couriers van front 3/4 view facing left",
  }),
  "rear-3q-right": resolveGeneratedState("van", "rear-3q-right", {
    alt: "KT Couriers van rear 3/4 view facing right",
  }),
  "rear-3q-left": resolveGeneratedState("van", "rear-3q-left", {
    alt: "KT Couriers van rear 3/4 view facing left",
  }),
  "centered-hero": resolveGeneratedState("van", "centered-hero", {
    alt: "KT Couriers van centered hero profile",
  }),
  "front-half-close": resolveGeneratedState("van", "front-half-close", {
    alt: "KT Couriers van front half crop",
  }),
  "rear-half-close": resolveGeneratedState("van", "rear-half-close", {
    alt: "KT Couriers van rear cargo area crop",
  }),
  "sliding-door-open": resolveGeneratedState("van", "sliding-door-open", {
    alt: "KT Couriers van with side sliding door open ready for parcel",
  }),
  "rear-doors-open": resolveGeneratedState("van", "rear-doors-open", {
    alt: "KT Couriers van rear doors open",
  }),
  "all-doors-open": resolveGeneratedState("van", "all-doors-open", {
    alt: "KT Couriers van side and rear doors open for major loading",
  }),
  "motion-transition": resolveGeneratedState("van", "motion-transition", {
    alt: "KT Couriers van arriving in slight motion",
  }),
};

// ---------------------------------------------------------------------------
// Red Freight Truck — 12 States (High-Intensity Network Heavy Haul)
// ---------------------------------------------------------------------------
export type RedTruckStateId =
  | "side-right" // 01
  | "side-left" // 02
  | "front-3q-right" // 03
  | "front-3q-left" // 04
  | "rear-3q-right" // 05
  | "rear-3q-left" // 06
  | "centered-hero" // 07
  | "cab-crop" // 08
  | "trailer-middle-crop" // 09
  | "rear-trailer-crop" // 10
  | "motion-entry" // 11
  | "curtain-open"; // 12

export const RED_TRUCK_STATES: Record<RedTruckStateId, ActorStateDefinition> = {
  "side-right": resolveGeneratedState("red-truck", "side-right", {
    alt: "KT Couriers heavy haul red truck side view right",
  }),
  "side-left": resolveGeneratedState("red-truck", "side-left", {
    alt: "KT Couriers heavy freight red truck side view left",
  }),
  "front-3q-right": resolveGeneratedState("red-truck", "front-3q-right", {
    alt: "KT Couriers heavy red truck front 3/4 view right",
  }),
  "front-3q-left": resolveGeneratedState("red-truck", "front-3q-left", {
    alt: "KT Couriers heavy red truck front 3/4 view left",
  }),
  "rear-3q-right": resolveGeneratedState("red-truck", "rear-3q-right", {
    alt: "KT Couriers heavy red truck rear 3/4 view right",
  }),
  "rear-3q-left": resolveGeneratedState("red-truck", "rear-3q-left", {
    alt: "KT Couriers heavy red truck rear 3/4 view left",
  }),
  "centered-hero": resolveGeneratedState("red-truck", "centered-hero", {
    alt: "KT Couriers red freight truck centered climax hero",
  }),
  "cab-crop": resolveGeneratedState("red-truck", "cab-crop", {
    alt: "KT Couriers heavy red truck cab detail",
  }),
  "trailer-middle-crop": resolveGeneratedState("red-truck", "trailer-middle-crop", {
    alt: "KT Couriers red freight trailer middle section",
  }),
  "rear-trailer-crop": resolveGeneratedState("red-truck", "rear-trailer-crop", {
    alt: "KT Couriers red freight rear trailer detail",
  }),
  "motion-entry": resolveGeneratedState("red-truck", "motion-entry", {
    alt: "KT Couriers red freight truck arriving on highway with motion energy",
  }),
  "curtain-open": resolveGeneratedState("red-truck", "curtain-open", {
    alt: "KT Couriers red freight trailer curtain partially open",
  }),
};
