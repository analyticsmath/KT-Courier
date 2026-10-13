import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("production delivery coverage freshness", () => {
  it("renders live coverage from operational data rather than a static build-time snapshot", () => {
    const source = readFileSync("app/(public)/coverage-areas/page.tsx", "utf8");
    expect(source).toContain('export const dynamic = "force-dynamic";');
    expect(source).toContain("await getPublicCoverageSnapshot()");
  });

  it("does not promise active operations if the coverage source is unavailable", () => {
    const source = readFileSync("components/public-v2/coverage/CoverageInteractiveView.tsx", "utf8");
    expect(source).not.toContain("Active delivery operations continue as normal.");
    expect(source).toContain("cannot be verified automatically");
  });

  it("states the documented multi-city Gauteng operating focus and verifies routes individually", () => {
    const page = readFileSync("components/public-v2/coverage/CoveragePage.tsx", "utf8");
    const details = readFileSync("components/public-v2/coverage/CoverageInteractiveView.tsx", "utf8");
    expect(page).toContain("Johannesburg, Pretoria, Gauteng and surrounding areas");
    expect(details).toContain("exact pickup and destination");
    expect(details).toContain("current operational capacity");
  });
});
