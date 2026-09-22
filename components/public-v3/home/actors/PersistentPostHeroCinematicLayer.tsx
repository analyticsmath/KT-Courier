"use client";

import { memo, type SyntheticEvent } from "react";
import { markPostHeroActorError, markPostHeroActorReady, POST_HERO_ACTOR_ASSETS } from "./post-hero-actor-preload";
import { POST_HERO_RESOLVER_ACTOR_STATES, type PostHeroActorKey, type PostHeroActorName } from "../director/post-hero-frame-resolver";
import styles from "../post-hero-scenes.module.css";

const ACTORS: readonly PostHeroActorName[] = ["van", "courier", "recipient", "handoff", "white-truck", "red-truck"];
const bank = (actor: PostHeroActorName) => POST_HERO_RESOLVER_ACTOR_STATES.filter((key) => key.startsWith(`${actor}:`)) as PostHeroActorKey[];

function ActorBank({ actor }: { actor: PostHeroActorName }) {
  const states = bank(actor);
  return <div data-posthero-actor-slot={actor} data-posthero-expected-actor={actor} data-posthero-displayed-state="" data-posthero-requested-state="" data-posthero-pending-state="" data-posthero-state-ready="false" data-posthero-visible="false" data-posthero-slot-opacity="0" className={styles.postHeroActorSlot} aria-hidden="true">
    {states.map((key, index) => {
      const asset = POST_HERO_ACTOR_ASSETS[key];
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={key} data-posthero-actor-state={key} data-posthero-actor-status="idle" src={asset.webpSrc} width={asset.width} height={asset.height} decoding="async" loading={index === 0 ? "eager" : "lazy"} alt="" aria-hidden="true" onLoad={(event: SyntheticEvent<HTMLImageElement>) => { if (event.currentTarget.naturalWidth > 0) markPostHeroActorReady(key); }} onError={() => markPostHeroActorError(key)} className={styles.postHeroActorState} />
      );
    })}
  </div>;
}

export const POST_HERO_RENDERED_ACTOR_STATES = [...POST_HERO_RESOLVER_ACTOR_STATES];
export const PersistentPostHeroCinematicLayer = memo(function PersistentPostHeroCinematicLayer() {
  return <div data-posthero-cinematic-layer className={styles.postHeroCinematicLayer} aria-hidden="true">{ACTORS.map((actor) => <ActorBank key={actor} actor={actor} />)}</div>;
});
