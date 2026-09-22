import type { GeneratedActorState } from "../../actors/generated-actor-media";
import type { ActorSize } from "./post-hero-frame-resolver";

export type PostHeroActorAnchor = { xVw: number; yVh: number };

export type PostHeroActorBox = {
  width: number;
  height: number;
  left: number;
  top: number;
  visibleWidth: number;
  visibleHeight: number;
};

/**
 * Resolve a generated actor canvas from its audited visible bounds.
 *
 * Generated actor visibleBounds are normalized ratios, not pixel dimensions.
 * Keeping this calculation in one pure helper prevents a second division by
 * native asset dimensions from reappearing in a scene-specific code path.
 */
export function computePostHeroActorBox({
  viewportWidth,
  viewportHeight,
  actor,
  size,
  anchor,
}: {
  viewportWidth: number;
  viewportHeight: number;
  actor: Pick<GeneratedActorState, "aspectRatio" | "visibleBounds" | "groundContact">;
  size: ActorSize;
  anchor: PostHeroActorAnchor;
}): PostHeroActorBox {
  const visibleWidthRatio = Math.max(0.01, actor.visibleBounds.width);
  const visibleHeightRatio = Math.max(0.01, actor.visibleBounds.height);
  const visibleWidth = size.mode === "visible-width" ? viewportWidth * size.valueVw / 100 : 0;
  const visibleHeight = size.mode === "visible-height" ? viewportHeight * size.valueVh / 100 : 0;
  const width = size.mode === "visible-width"
    ? visibleWidth / visibleWidthRatio
    : (visibleHeight / visibleHeightRatio) * actor.aspectRatio;
  const height = size.mode === "visible-height"
    ? visibleHeight / visibleHeightRatio
    : width / Math.max(0.01, actor.aspectRatio);
  const targetX = viewportWidth * anchor.xVw / 100;
  const targetY = viewportHeight * anchor.yVh / 100;
  return {
    width,
    height,
    left: targetX - width * actor.groundContact.x,
    top: targetY - height * actor.groundContact.y,
    visibleWidth: width * visibleWidthRatio,
    visibleHeight: height * visibleHeightRatio,
  };
}
