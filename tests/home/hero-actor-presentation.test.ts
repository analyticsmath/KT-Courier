import { describe, expect, it } from "vitest";
import { deriveHeroActorPresentation } from "@/components/public-v3/home/director/hero-actor-presentation";
import { closestReadyHeroSequenceState } from "@/components/public-v3/home/director/home-actor-image-readiness";
import { resolveHomeFrame } from "@/components/public-v3/home/director/home-frame-resolver";

describe("Hero actor presentation invariant", () => {
  it("exposes every ready, visible Hero frame with positive geometry", () => {
    for (const progress of [0.18, 0.3, 0.45, 0.55, 0.62, 0.72, 0.84, 0.94, 0.98]) {
      const actor = resolveHomeFrame({ chapter: "hero", progress, viewportMode: "mobile" }).actors.whiteTruck;
      const readyFallback = closestReadyHeroSequenceState(actor.state, new Set([actor.state]));
      const presentation = deriveHeroActorPresentation({
        actorVisible: actor.visible,
        imageReady: true,
        width: 320,
        height: 180,
      });
      expect(progress).toBeGreaterThanOrEqual(0.13);
      expect(actor.visible).toBe(true);
      expect(readyFallback).toBe(actor.state);
      expect(presentation).toEqual({ opacity: 1, visibility: "visible", isVisible: true });
    }
  });

  it("keeps an unready or geometry-less frame transparent without hiding its slot", () => {
    expect(deriveHeroActorPresentation({ actorVisible: true, imageReady: false, width: 320, height: 180 }))
      .toEqual({ opacity: 0, visibility: "visible", isVisible: false });
    expect(deriveHeroActorPresentation({ actorVisible: true, imageReady: true, width: 0, height: 180 }))
      .toEqual({ opacity: 0, visibility: "visible", isVisible: false });
  });
});
