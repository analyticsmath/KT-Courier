import {
  COURIER_STATES,
  RED_TRUCK_STATES,
  VAN_STATES,
  WHITE_TRUCK_STATES,
  type ActorStateDefinition,
} from "../../actors/actor-state-machine";

export type ActorType = "white-truck" | "van" | "courier" | "red-truck";

const ACTOR_STATES: Record<ActorType, Record<string, ActorStateDefinition>> = {
  "white-truck": WHITE_TRUCK_STATES,
  van: VAN_STATES,
  courier: COURIER_STATES,
  "red-truck": RED_TRUCK_STATES,
};

export interface ActorTransition {
  actor: ActorType;
  from: string;
  to: string;
  occlusion: string;
}

export const HOME_ACTOR_TRANSITIONS: readonly ActorTransition[] = [
  { actor: "white-truck", from: "front-3q-right", to: "side-right", occlusion: "typography-occlusion" },
  { actor: "white-truck", from: "side-right", to: "wide-hero", occlusion: "typography-occlusion" },
  { actor: "white-truck", from: "wide-hero", to: "cargo-box-close", occlusion: "trailer-takeover" },
  { actor: "van", from: "motion-transition", to: "side-left", occlusion: "scene-boundary" },
  { actor: "van", from: "side-left", to: "sliding-door-open", occlusion: "door-sequence" },
  { actor: "courier", from: "look-left-approach", to: "lift-parcel", occlusion: "van-door" },
  { actor: "courier", from: "lift-parcel", to: "loading-unloading", occlusion: "parcel-coverage" },
  { actor: "courier", from: "loading-unloading", to: "ready-handover", occlusion: "custody-seam" },
  { actor: "white-truck", from: "top-down-straight", to: "top-down-angled", occlusion: "overpass-shadow" },
  { actor: "white-truck", from: "top-down-angled", to: "top-down-turning", occlusion: "overpass-shadow" },
  { actor: "red-truck", from: "motion-entry", to: "side-right", occlusion: "viewport-edge" },
  { actor: "red-truck", from: "side-right", to: "centered-hero", occlusion: "scene-boundary" },
  { actor: "courier", from: "walk-left-one-parcel", to: "extending-handoff", occlusion: "architectural-mask" },
];

export function assertActorTransition(
  actor: ActorType,
  previousState: string,
  nextState: string,
  activeOcclusion: string | null,
): void {
  const previous = ACTOR_STATES[actor][previousState];
  const next = ACTOR_STATES[actor][nextState];
  const errors: string[] = [];

  if (!previous || !next) {
    errors.push(`Unknown ${actor} state: ${previousState} → ${nextState}`);
  } else {
    if (!previous.validNextStates?.includes(nextState)) {
      errors.push(`${actor}:${previousState} does not allow next state ${nextState}`);
    }
    if (!next.validPreviousStates?.includes(previousState)) {
      errors.push(`${actor}:${nextState} does not allow previous state ${previousState}`);
    }
    const requiredOcclusions = [previous.requiredOcclusion, next.requiredOcclusion].filter(Boolean);
    if (!activeOcclusion || !requiredOcclusions.includes(activeOcclusion as never)) {
      errors.push(`${actor}:${previousState} → ${nextState} requires an active occlusion (${requiredOcclusions.join(" or ")})`);
    }
  }

  if (errors.length && process.env.NODE_ENV !== "production") {
    throw new Error(`[HomeDirector] Invalid actor transition: ${errors.join("; ")}`);
  }
}

export function validateHomeActorTransitions(): void {
  for (const transition of HOME_ACTOR_TRANSITIONS) {
    assertActorTransition(
      transition.actor,
      transition.from,
      transition.to,
      transition.occlusion,
    );
  }
}
