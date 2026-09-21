import { describe, expect, it } from "vitest";
import { resolvePostHeroActorLifecycle } from "@/components/public-v3/home/actors/post-hero-cinematic-runtime";

const closedVan = "van:collection-side-right" as const;
const openVan = "van:collection-door-open-right" as const;

describe("persistent post-Hero actor state handoffs", () => {
  it("positions and exposes a first requested state while its image is still loading", () => {
    expect(resolvePostHeroActorLifecycle({
      requestedState: closedVan,
      requestedReady: false,
      visible: true,
    })).toEqual({
      requestedState: closedVan,
      displayedState: closedVan,
      pendingState: closedVan,
      visible: true,
      stateReady: false,
    });
  });

  it("keeps the last valid displayed actor while the successor is pending", () => {
    expect(resolvePostHeroActorLifecycle({
      requestedState: openVan,
      requestedReady: false,
      visible: true,
      previous: {
        requestedState: closedVan,
        displayedState: closedVan,
        pendingState: null,
        visible: true,
      },
    })).toEqual({
      requestedState: openVan,
      displayedState: closedVan,
      pendingState: openVan,
      visible: true,
      stateReady: false,
    });
  });

  it("replaces the state only once its requested layer is ready", () => {
    expect(resolvePostHeroActorLifecycle({
      requestedState: openVan,
      requestedReady: true,
      visible: true,
      previous: {
        requestedState: openVan,
        displayedState: closedVan,
        pendingState: openVan,
        visible: true,
      },
    })).toEqual({
      requestedState: openVan,
      displayedState: openVan,
      pendingState: null,
      visible: true,
      stateReady: true,
    });
  });

  it("hides an actor only when its frame explicitly exits it", () => {
    expect(resolvePostHeroActorLifecycle({
      requestedState: closedVan,
      requestedReady: true,
      visible: false,
      previous: {
        requestedState: closedVan,
        displayedState: closedVan,
        pendingState: null,
        visible: true,
      },
    })).toMatchObject({ displayedState: closedVan, pendingState: null, visible: false });
  });
});
