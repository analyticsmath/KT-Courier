import { describe, expect, it } from "vitest";
import { closestReadyHeroSequenceState, isActorImageReady } from "@/components/public-v3/home/director/home-actor-image-readiness";

function imageState({ complete, naturalWidth, ready = false }: { complete: boolean; naturalWidth: number; ready?: boolean }): HTMLImageElement {
  return {
    complete,
    naturalWidth,
    dataset: ready ? { actorStateReady: "true" } : {},
  } as unknown as HTMLImageElement;
}

describe("actor image readiness", () => {
  it("accepts a fully loaded image without a decode marker", () => {
    expect(isActorImageReady(imageState({ complete: true, naturalWidth: 960 }))).toBe(true);
  });

  it("accepts the explicit actor load-ready marker", () => {
    expect(isActorImageReady(imageState({ complete: false, naturalWidth: 0, ready: true }))).toBe(true);
  });

  it("rejects an incomplete image without a ready marker", () => {
    expect(isActorImageReady(imageState({ complete: false, naturalWidth: 0 }))).toBe(false);
  });

  it("holds the closest ready frame in the same white-truck sequence", () => {
    expect(closestReadyHeroSequenceState("true-front-center-medium", new Set(["true-front-center-full"])))
      .toBe("true-front-center-full");
    expect(closestReadyHeroSequenceState("front-3q-entry-phase-04", new Set([
      "front-3q-entry-phase-03",
      "front-3q-entry-phase-05",
    ]))).toBe("front-3q-entry-phase-03");
    expect(closestReadyHeroSequenceState("front-3q-entry-phase-04", new Set())).toBeNull();
  });
});
