import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { HOME_CHAPTERS } from "@/components/public-v3/home/director/home-chapters";
import { resolveHomeFrame } from "@/components/public-v3/home/director/home-frame-resolver";

const root = process.cwd();
const sourceFiles = [
  "components/public-v3/home/PublicHomeExperience.tsx",
  "components/public-v3/home/scenes/MarketplaceFivePanelScene.tsx",
  "components/public-v3/actors/CinematicActorStage.tsx",
  "components/public-v3/home/director/useHomeNarrativeDirector.ts",
  "components/public-v3/home/home-scenes.module.css",
].map((path) => readFileSync(join(root, path), "utf8")).join("\n");

describe("post-Hero V2 contracts", () => {
  it("has a visual owner for every normalized post-Hero frame", () => {
    for (const chapter of HOME_CHAPTERS.filter((chapter) => chapter !== "hero")) {
      for (let step = 0; step <= 40; step += 1) {
        const frame = resolveHomeFrame({ chapter, progress: step / 40, viewportMode: "desktop" });
        expect(frame.visual.primaryOwner).toBeTruthy();
      }
    }
  });

  it("does not retain the generic occluder or final-release architecture", () => {
    [
      "arrival-architecture-mask",
      "kt-home-final-release-curtain",
      "route-terminal-mask",
      "freight-gate-mask",
      "custody-seam-mask",
      "route-overpass-a",
      "route-overpass-b",
    ].forEach((forbidden) => expect(sourceFiles).not.toContain(forbidden));
  });

  it("removes visible marketplace index and giant category-word machinery", () => {
    expect(sourceFiles).not.toContain("marketplaceIndex");
    expect(sourceFiles).not.toContain("market-word");
    expect(sourceFiles).not.toContain("marketplaceWordPlane");
  });
});
