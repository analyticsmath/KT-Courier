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
  minimumCoverage: number;
}

/** Only transitions that occur in an exposed chapter are listed; each names its rendered covering element. */
export const HOME_ACTOR_TRANSITIONS: readonly ActorTransition[] = [
  { actor: "white-truck", from: "front-3q-right", to: "side-right", occlusion: "hero-typography-mask", minimumCoverage: 0.9 },
  { actor: "white-truck", from: "side-right", to: "wide-hero", occlusion: "hero-typography-mask", minimumCoverage: 0.9 },
  { actor: "white-truck", from: "wide-hero", to: "cargo-box-close", occlusion: "hero-cargo-mask", minimumCoverage: 0.9 },
  { actor: "courier", from: "look-left-approach", to: "lift-parcel", occlusion: "parcel-mask", minimumCoverage: 0.9 },
  { actor: "courier", from: "lift-parcel", to: "loading-unloading", occlusion: "parcel-mask", minimumCoverage: 0.9 },
  { actor: "white-truck", from: "top-down-straight", to: "top-down-angled", occlusion: "route-overpass-a", minimumCoverage: 0.92 },
  { actor: "white-truck", from: "top-down-angled", to: "top-down-turning", occlusion: "route-overpass-b", minimumCoverage: 0.92 },
  { actor: "courier", from: "walk-left-one-parcel", to: "extending-handoff", occlusion: "arrival-architecture-mask", minimumCoverage: 0.9 },
];

export function assertActorTransition(
  actor: ActorType,
  previousState: string,
  nextState: string,
  activeOcclusion: string | null,
): void {
  const previous = ACTOR_STATES[actor][previousState];
  const next = ACTOR_STATES[actor][nextState];
  const declared = HOME_ACTOR_TRANSITIONS.find((item) =>
    item.actor === actor && item.from === previousState && item.to === nextState,
  );
  const errors: string[] = [];

  if (!previous || !next) {
    errors.push(`Unknown ${actor} state: ${previousState} → ${nextState}`);
  } else {
    if (!previous.validNextStates?.includes(nextState)) errors.push(`${actor}:${previousState} does not allow next state ${nextState}`);
    if (!next.validPreviousStates?.includes(previousState)) errors.push(`${actor}:${nextState} does not allow previous state ${previousState}`);
    if (!declared) errors.push(`${actor}:${previousState} → ${nextState} has no physical transition declaration`);
    else if (activeOcclusion !== declared.occlusion) errors.push(`${actor}:${previousState} → ${nextState} requires rendered occluder ${declared.occlusion}`);
  }

  if (errors.length && process.env.NODE_ENV !== "production") {
    throw new Error(`[HomeDirector] Invalid actor transition: ${errors.join("; ")}`);
  }
}

export function validateHomeActorTransitions(): void {
  for (const transition of HOME_ACTOR_TRANSITIONS) {
    assertActorTransition(transition.actor, transition.from, transition.to, transition.occlusion);
  }
}
