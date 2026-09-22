import { GENERATED_ACTOR_STATES, type GeneratedActorState } from "../../actors/generated-actor-media";
import { POST_HERO_RESOLVER_ACTOR_STATES, type PostHeroActorKey, type PostHeroActorName } from "../director/post-hero-frame-resolver";

export const POST_HERO_ACTOR_ASSETS = Object.fromEntries(
  POST_HERO_RESOLVER_ACTOR_STATES.map((key) => {
    const [actorType, id] = key.split(":");
    const state = GENERATED_ACTOR_STATES[`${actorType}:${id}`];
    if (!state) throw new Error(`[PostHeroActor] Missing generated state ${key}`);
    return [key, state];
  }),
) as Record<PostHeroActorKey, GeneratedActorState>;

export type PostHeroActorStatus = "idle" | "loading" | "ready" | "error";
const statuses = new Map<PostHeroActorKey, PostHeroActorStatus>();
const pending = new Map<PostHeroActorKey, Promise<boolean>>();
export function isPostHeroActorReady(key: PostHeroActorKey): boolean { return statuses.get(key) === "ready"; }
export function getPostHeroActorStatus(key: PostHeroActorKey): PostHeroActorStatus { return statuses.get(key) ?? "idle"; }
export function markPostHeroActorReady(key: PostHeroActorKey): void { statuses.set(key, "ready"); if (typeof window !== "undefined") window.dispatchEvent(new Event("kt-posthero-actor-ready")); }
export function markPostHeroActorError(key: PostHeroActorKey): void { statuses.set(key, "error"); }
export function preloadPostHeroActor(key: PostHeroActorKey): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (isPostHeroActorReady(key)) return Promise.resolve(true);
  const existing = pending.get(key); if (existing) return existing;
  const request = new Promise<boolean>((resolve) => { const image = new window.Image(); image.decoding = "async"; image.onload = () => { markPostHeroActorReady(key); resolve(true); }; image.onerror = () => { markPostHeroActorError(key); resolve(false); }; image.src = POST_HERO_ACTOR_ASSETS[key].webpSrc; });
  pending.set(key, request); return request.finally(() => pending.delete(key));
}
const keysFor = (family: PostHeroActorName): PostHeroActorKey[] => POST_HERO_RESOLVER_ACTOR_STATES.filter((key) => key.startsWith(`${family}:`)) as PostHeroActorKey[];
export function postHeroActorsForChapter(chapter: "network" | "freight" | "last-mile"): readonly PostHeroActorKey[] {
  if (chapter === "network") return keysFor("white-truck");
  if (chapter === "freight") return keysFor("red-truck");
  return [...keysFor("van"), ...keysFor("courier"), ...keysFor("recipient"), ...keysFor("handoff")];
}
export async function preloadPostHeroActorsForChapter(chapter: "network" | "freight" | "last-mile"): Promise<boolean> {
  const results = await Promise.all(postHeroActorsForChapter(chapter).map(preloadPostHeroActor));
  return results.every(Boolean);
}
