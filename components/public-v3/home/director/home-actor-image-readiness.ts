import { HERO_VAN_SEQUENCE } from "./hero-van-sequence.generated";

const decoding = new WeakMap<HTMLImageElement, Promise<void>>();

export function isActorImageReady(image?: HTMLImageElement): boolean {
  return Boolean(
    image
    && image.dataset.actorStateReady === "true",
  );
}

export function markActorImageReady(image: HTMLImageElement): boolean {
  if (!image.complete || image.naturalWidth <= 0) return false;
  image.dataset.actorStateReady = "true";
  return true;
}

/** Activates a frame only when requested, then waits for its browser decode. */
export function decodeHeroVanFrame(image?: HTMLImageElement): Promise<void> {
  if (!image || isActorImageReady(image)) return Promise.resolve();
  const existing = decoding.get(image);
  if (existing) return existing;
  const source = image.parentElement?.querySelector("source");
  if (source && !source.srcset) source.srcset = source.dataset.heroMobileSrc ?? "";
  if (!image.getAttribute("src")) image.src = image.dataset.heroDesktopSrc ?? "";
  const pending = (async () => {
    if (typeof image.decode === "function") await image.decode();
    else if (!image.complete) await new Promise<void>((resolve, reject) => {
      image.addEventListener("load", () => resolve(), { once: true });
      image.addEventListener("error", () => reject(new Error("Hero frame failed to load")), { once: true });
    });
    if (markActorImageReady(image)) window.dispatchEvent(new Event("kt-hero-van-ready"));
  })().catch(() => {}).finally(() => decoding.delete(image));
  decoding.set(image, pending);
  return pending;
}

export function decodeHeroVanWindow(layers: ReadonlyMap<string, HTMLImageElement>, requestedState: string): void {
  const index = HERO_VAN_SEQUENCE.indexOf(requestedState);
  if (index < 0) return;
  for (let offset = -1; offset <= 3; offset++) {
    const state = HERO_VAN_SEQUENCE[index + offset];
    if (state) void decodeHeroVanFrame(layers.get(state));
  }
}

export function closestReadyHeroSequenceState(
  requestedState: string,
  readyStates: ReadonlySet<string>,
): string | null {
  const requestedIndex = HERO_VAN_SEQUENCE.indexOf(requestedState);
  if (requestedIndex < 0) return null;

  return HERO_VAN_SEQUENCE
    .map((state, index) => ({ state, index }))
    .filter(({ state }) => readyStates.has(state))
    .sort((a, b) => Math.abs(a.index - requestedIndex) - Math.abs(b.index - requestedIndex) || a.index - b.index)[0]
    ?.state ?? null;
}
