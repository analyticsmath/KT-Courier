import type { HomeFrame } from "./home-frame-resolver";

export function formatHomeDebugFrame(frame: HomeFrame): string {
  const actorLine = (label: string, actor: HomeFrame["actors"]["whiteTruck"]) =>
    `${label}: ${actor.state} · ${actor.visible ? "visible" : "hidden"}`;
  const ownership = [
    frame.sceneOwnership.previous ?? "—",
    frame.sceneOwnership.current,
    frame.sceneOwnership.next ?? "—",
  ].join(" → ");

  return [
    `chapter: ${frame.chapter}`,
    `progress: ${frame.chapterProgress.toFixed(3)}`,
    `world owner: ${frame.world.owner} · incoming: ${frame.world.incoming ?? "—"} · blend: ${frame.world.blend.toFixed(3)}`,
    `camera: ${frame.world.cameraMode} · focus: ${frame.world.focus}`,
    `selected marketplace: ${frame.selection.marketplaceId ?? "—"}`,
    `scene owner: ${ownership}`,
    `transition: ${frame.transition.owner ?? "—"} · ${frame.transition.progress.toFixed(3)}`,
    actorLine("white truck", frame.actors.whiteTruck),
    actorLine("van", frame.actors.van),
    actorLine("courier", frame.actors.courier),
    actorLine("red truck", frame.actors.redTruck),
    `occluder: ${frame.occlusion.id ?? "—"} · coverage target: ${(frame.occlusion.requiredCoverage * 100).toFixed(0)}%`,
    `route path: ${frame.route.pathProgress.toFixed(3)} · tangent: ${frame.route.tangentAngle.toFixed(1)}°`,
    `market: ${frame.marketplace.activeId ?? "—"} · index ${frame.marketplace.activeIndex}`,
    `fan: ${frame.fan.phase} · ${frame.fan.selectedId ?? "—"}`,
    `header: ${frame.headerTone}`,
  ].join("\n");
}
