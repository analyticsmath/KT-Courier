"use client";

import { memo, type SyntheticEvent } from "react";
import {
  markPostHeroActorError,
  markPostHeroActorReady,
  POST_HERO_ACTOR_ASSETS,
} from "./post-hero-actor-preload";
import type { PostHeroActorKey, PostHeroActorName } from "../director/post-hero-frame-resolver";
import styles from "../post-hero-scenes.module.css";

const ACTOR_BANKS: Readonly<Record<PostHeroActorName, readonly PostHeroActorKey[]>> = {
  van: ["van:collection-side-right", "van:collection-door-open-right"],
  courier: [
    "courier:look-right-approach",
    "courier:lift-parcel",
    "courier:loading-unloading",
    "courier:ready-handover",
  ],
  "white-truck": ["white-truck:top-down-straight"],
  "red-truck": ["red-truck:side-right"],
};

const DEFERRED_FREIGHT_STATES = new Set<PostHeroActorKey>([
  "white-truck:top-down-straight",
  "red-truck:side-right",
]);

export const POST_HERO_RENDERED_ACTOR_STATES = Object.keys(POST_HERO_ACTOR_ASSETS) as PostHeroActorKey[];

function markLoaded(key: PostHeroActorKey, event: SyntheticEvent<HTMLImageElement>) {
  const image = event.currentTarget;
  if (image.naturalWidth > 0) markPostHeroActorReady(key);
}

function markFailed(key: PostHeroActorKey) {
  markPostHeroActorError(key);
}

function ActorBank({ actor, states }: { actor: PostHeroActorName; states: readonly PostHeroActorKey[] }) {
  return (
    <div
      data-posthero-actor-slot={actor}
      data-posthero-expected-actor={actor}
      data-posthero-displayed-state=""
      data-posthero-requested-state=""
      data-posthero-state-ready="false"
      data-posthero-slot-opacity="0"
      data-posthero-x="0"
      data-posthero-y="0"
      data-posthero-width="0"
      className={styles.postHeroActorSlot}
      aria-hidden="true"
    >
      {states.map((key) => {
        const asset = POST_HERO_ACTOR_ASSETS[key];
        const deferred = DEFERRED_FREIGHT_STATES.has(key);
        return (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={key}
            data-posthero-actor-state={key}
            data-posthero-actor-status="idle"
            src={asset.webpSrc}
            width={asset.width}
            height={asset.height}
            decoding="async"
            loading={deferred ? "lazy" : "eager"}
            alt=""
            aria-hidden="true"
            onLoad={(event) => markLoaded(key, event)}
            onError={() => markFailed(key)}
            className={styles.postHeroActorState}
          />
        );
      })}
    </div>
  );
}

/** One viewport actor layer carries pickup, route, and freight through both chapters. */
export const PersistentPostHeroCinematicLayer = memo(function PersistentPostHeroCinematicLayer() {
  return (
    <div
      data-posthero-cinematic-layer
      className={styles.postHeroCinematicLayer}
      aria-hidden="true"
    >
      {(Object.entries(ACTOR_BANKS) as [PostHeroActorName, readonly PostHeroActorKey[]][]).map(([actor, states]) => (
        <ActorBank key={actor} actor={actor} states={states} />
      ))}
    </div>
  );
});
