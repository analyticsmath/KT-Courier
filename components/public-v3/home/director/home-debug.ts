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
    `scene owner: ${ownership}`,
    `transition: ${frame.transition.owner ?? "—"} · ${frame.transition.progress.toFixed(3)}`,
    actorLine("white truck", frame.actors.whiteTruck),
    actorLine("van", frame.actors.van),
    actorLine("courier", frame.actors.courier),
    actorLine("red truck", frame.actors.redTruck),
    `occluder: ${frame.transition.occlusion ?? "—"}`,
    `market: ${frame.marketplace.activeId ?? "—"}`,
    `fan: ${frame.fan.phase}`,
    `header: ${frame.headerTone}`,
  ].join("\n");
}
