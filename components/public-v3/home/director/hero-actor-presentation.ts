export type HeroActorPresentation = {
  opacity: 0 | 1;
  visibility: "visible";
  isVisible: boolean;
};

/**
 * The Hero truck slot is renderable only when its selected ready frame has
 * usable geometry. Visibility intentionally remains CSS-visible so a ready
 * frame never depends on GSAP reversing an inherited visibility gate.
 */
export function deriveHeroActorPresentation({
  actorVisible,
  imageReady,
  width,
  height,
}: {
  actorVisible: boolean;
  imageReady: boolean;
  width: number;
  height: number;
}): HeroActorPresentation {
  const isVisible = actorVisible && imageReady && width > 0 && height > 0;
  return {
    opacity: isVisible ? 1 : 0,
    visibility: "visible",
    isVisible,
  };
}
