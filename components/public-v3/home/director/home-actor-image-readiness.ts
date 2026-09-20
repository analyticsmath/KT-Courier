import { HERO_TRUCK_SEQUENCE } from "../../actors/actor-state-machine";

export function isActorImageReady(image?: HTMLImageElement): boolean {
  return Boolean(
    image
    && (
      image.dataset.actorStateReady === "true"
      || (image.complete && image.naturalWidth > 0)
    ),
  );
}

export function markActorImageReady(image: HTMLImageElement): boolean {
  if (!image.complete || image.naturalWidth <= 0) return false;
  image.dataset.actorStateReady = "true";
  return true;
}

export function closestReadyHeroSequenceState(
  requestedState: string,
  readyStates: ReadonlySet<string>,
): string | null {
  const requestedIndex = HERO_TRUCK_SEQUENCE.indexOf(requestedState as (typeof HERO_TRUCK_SEQUENCE)[number]);
  if (requestedIndex < 0) return null;

  return HERO_TRUCK_SEQUENCE
    .map((state, index) => ({ state, index }))
    .filter(({ state }) => readyStates.has(state))
    .sort((a, b) => Math.abs(a.index - requestedIndex) - Math.abs(b.index - requestedIndex) || a.index - b.index)[0]
    ?.state ?? null;
}
