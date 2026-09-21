import {
  COURIER_STATES,
  RED_TRUCK_STATES,
  VAN_STATES,
  WHITE_TRUCK_STATES,
  type ActorStateDefinition,
} from "../../actors/actor-state-machine";
import type { PostHeroActorKey } from "../director/post-hero-frame-resolver";

export const POST_HERO_ACTOR_ASSETS: Record<PostHeroActorKey, ActorStateDefinition> = {
  "van:collection-side-right": VAN_STATES["collection-side-right"],
  "van:collection-door-open-right": VAN_STATES["collection-door-open-right"],
  "courier:look-right-approach": COURIER_STATES["look-right-approach"],
  "courier:lift-parcel": COURIER_STATES["lift-parcel"],
  "courier:loading-unloading": COURIER_STATES["loading-unloading"],
  "courier:ready-handover": COURIER_STATES["ready-handover"],
  "white-truck:top-down-straight": WHITE_TRUCK_STATES["top-down-straight"],
  "red-truck:side-right": RED_TRUCK_STATES["side-right"],
  "courier:extending-handoff": COURIER_STATES["extending-handoff"],
};

export type PostHeroActorStatus = "idle" | "loading" | "ready" | "error";

const statuses = new Map<PostHeroActorKey, PostHeroActorStatus>();
const pending = new Map<PostHeroActorKey, Promise<boolean>>();

export function isPostHeroActorReady(key: PostHeroActorKey): boolean {
  return statuses.get(key) === "ready";
}

export function getPostHeroActorStatus(key: PostHeroActorKey): PostHeroActorStatus {
  return statuses.get(key) ?? "idle";
}

/** Decode a critical actor asset before the scroll director can reveal its slot. */
export function preloadPostHeroActor(key: PostHeroActorKey): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (isPostHeroActorReady(key)) return Promise.resolve(true);
  const existing = pending.get(key);
  if (existing) return existing;

  const definition = POST_HERO_ACTOR_ASSETS[key];
  statuses.set(key, "loading");
  const request = new Promise<boolean>((resolve) => {
    const image = new window.Image();
    image.decoding = "async";
    image.onload = () => {
      statuses.set(key, "ready");
      resolve(true);
    };
    image.onerror = () => {
      statuses.set(key, "error");
      if (process.env.NODE_ENV !== "production") {
        console.warn(`[PostHeroActor] Could not preload ${key} (${definition.webpSrc}).`);
      }
      resolve(false);
    };
    image.src = definition.webpSrc;
    if (typeof image.decode === "function") {
      void image.decode().then(() => {
        if (image.naturalWidth > 0) {
          statuses.set(key, "ready");
          resolve(true);
        }
      }).catch(() => {
        // onload/onerror remains the authoritative fallback for older engines.
      });
    }
  }).finally(() => pending.delete(key));
  pending.set(key, request);
  return request;
}

const CHAPTER_ACTOR_ASSETS: Record<"journey" | "freight" | "finale", readonly PostHeroActorKey[]> = {
  journey: [
    "van:collection-side-right",
    "van:collection-door-open-right",
    "courier:look-right-approach",
    "courier:lift-parcel",
    "courier:loading-unloading",
    "courier:ready-handover",
  ],
  freight: ["white-truck:top-down-straight", "red-truck:side-right"],
  finale: ["courier:extending-handoff"],
};

export function postHeroActorsForChapter(chapter: keyof typeof CHAPTER_ACTOR_ASSETS): readonly PostHeroActorKey[] {
  return CHAPTER_ACTOR_ASSETS[chapter];
}

export async function preloadPostHeroActorsForChapter(
  chapter: keyof typeof CHAPTER_ACTOR_ASSETS,
): Promise<boolean> {
  const results = await Promise.all(CHAPTER_ACTOR_ASSETS[chapter].map(preloadPostHeroActor));
  return results.every(Boolean);
}
