import { HOME_CINEMATIC_ASSET_BY_ID } from "../data/home-cinematic-assets.generated";
import { HOME_COMPOSED_ACTOR_BY_ID } from "../data/home-composed-actors.generated";

const decoded = new Set<string>();
const pending = new Map<string, Promise<void>>();

export function cinematicAssetUrl(id: string, mobile: boolean): string {
  const asset = HOME_CINEMATIC_ASSET_BY_ID[id];
  if (asset) return mobile ? asset.mobileSrc : asset.desktopSrc;
  const actor = HOME_COMPOSED_ACTOR_BY_ID[id];
  if (actor) return mobile ? actor.mobile : actor.desktop;
  throw new Error(`Unknown home cinematic asset: ${id}`);
}

export function preloadCinematicAsset(id: string, mobile: boolean): Promise<void> {
  const url = cinematicAssetUrl(id, mobile);
  if (typeof window === "undefined" || decoded.has(url)) return Promise.resolve();
  const existing = pending.get(url);
  if (existing) return existing;
  const image = new window.Image();
  image.src = url;
  const promise = (image.decode ? image.decode() : new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error(`Failed to load ${url}`));
  })).then(() => {
    decoded.add(url);
    window.dispatchEvent(new Event("kt-home-cinematic-ready"));
  }).catch(() => {
    pending.delete(url);
  });
  pending.set(url, promise);
  return promise;
}

/** Retain the last decoded frame while a newly requested state decodes. */
export function showCinematicFrame(image: HTMLImageElement | null, id: string, mobile: boolean): boolean {
  if (!image) return false;
  const url = cinematicAssetUrl(id, mobile);
  if (!decoded.has(url)) {
    void preloadCinematicAsset(id, mobile);
    return Boolean(image.getAttribute("src"));
  }
  if (image.getAttribute("src") !== url) image.src = url;
  image.dataset.cinematicDisplayedId = id;
  return true;
}
