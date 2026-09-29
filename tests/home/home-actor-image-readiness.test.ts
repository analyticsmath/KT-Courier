import { describe, expect, it } from "vitest";
import { closestReadyHeroSequenceState, isActorImageReady } from "@/components/public-v3/home/director/home-actor-image-readiness";
import { HERO_VAN_SEQUENCE } from "@/components/public-v3/home/director/hero-van-sequence.generated";

function imageState({ complete, naturalWidth, ready = false }: { complete: boolean; naturalWidth: number; ready?: boolean }): HTMLImageElement {
  return {
    complete,
    naturalWidth,
    dataset: ready ? { actorStateReady: "true" } : {},
  } as unknown as HTMLImageElement;
}

describe("actor image readiness", () => {
  it("waits for an explicit decode marker even when image bytes have loaded", () => {
    expect(isActorImageReady(imageState({ complete: true, naturalWidth: 960 }))).toBe(false);
  });

  it("accepts the explicit actor load-ready marker", () => {
    expect(isActorImageReady(imageState({ complete: false, naturalWidth: 0, ready: true }))).toBe(true);
  });

  it("rejects an incomplete image without a ready marker", () => {
    expect(isActorImageReady(imageState({ complete: false, naturalWidth: 0 }))).toBe(false);
  });

  it("holds the closest ready state in the authored Hero sequence", () => {
    expect(closestReadyHeroSequenceState(HERO_VAN_SEQUENCE[10], new Set([HERO_VAN_SEQUENCE[11]])))
      .toBe(HERO_VAN_SEQUENCE[11]);
    expect(closestReadyHeroSequenceState(HERO_VAN_SEQUENCE[10], new Set([HERO_VAN_SEQUENCE[9], HERO_VAN_SEQUENCE[11]])))
      .toBe(HERO_VAN_SEQUENCE[9]);
    expect(closestReadyHeroSequenceState(HERO_VAN_SEQUENCE[10], new Set())).toBeNull();
  });
});
