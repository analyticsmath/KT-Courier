"use client";

import type { CSSProperties } from "react";
import Image from "next/image";
import {
  POST_HERO_ACTOR_ASSETS,
  type PostHeroActorStatus,
} from "./post-hero-actor-preload";
import type { PostHeroActorKey } from "../director/post-hero-frame-resolver";
import styles from "../post-hero-scenes.module.css";

export const POST_HERO_RENDERED_ACTOR_STATES = Object.keys(POST_HERO_ACTOR_ASSETS) as PostHeroActorKey[];

export function renderedPostHeroActorStates(): readonly PostHeroActorKey[] {
  return POST_HERO_RENDERED_ACTOR_STATES;
}

export function PostHeroActorSprite({
  state,
  className = "",
  style,
  status,
}: {
  state: PostHeroActorKey;
  className?: string;
  style?: CSSProperties;
  status?: PostHeroActorStatus;
}) {
  const asset = POST_HERO_ACTOR_ASSETS[state];
  return (
    <Image
      data-posthero-actor-state={state}
      data-posthero-actor-status={status ?? "idle"}
      src={asset.webpSrc}
      width={asset.width}
      height={asset.height}
      sizes="100vw"
      unoptimized
      alt=""
      decoding="async"
      loading="eager"
      aria-hidden="true"
      className={`${styles.postHeroActorState} ${className}`}
      style={style}
    />
  );
}

export function PostHeroActorBank({
  actor,
  scene,
  states,
  className = "",
}: {
  actor: "van" | "courier" | "white-truck" | "red-truck";
  scene: "journey" | "freight" | "finale";
  states: readonly PostHeroActorKey[];
  className?: string;
}) {
  const actorStates = states.filter((state) => state.startsWith(`${actor}:`));

  return (
    <div
      data-posthero-actor-slot={actor}
      data-posthero-scene={scene}
      className={`${styles.postHeroActorSlot} ${className}`}
      aria-hidden="true"
    >
      {actorStates.map((state) => (
        <PostHeroActorSprite key={state} state={state} />
      ))}
    </div>
  );
}
