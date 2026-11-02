import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { indexPublicCoverageMapRegions } from "@/lib/public-coverage/indexed-map-regions";

describe("public coverage map index integrity", () => {
  it("preserves actual region indexes when province-wide coverage lacks a map centre", () => {
    const regions = [
      { name: "Johannesburg", centerLat: -26.2, centerLng: 28.0 },
      { name: "Gauteng province-wide", centerLat: null, centerLng: null },
      { name: "Pretoria", centerLat: -25.7, centerLng: 28.2 },
    ];
    expect(indexPublicCoverageMapRegions(regions).map(x => [x.region.name, x.index]))
      .toEqual([["Johannesburg", 0], ["Pretoria", 2]]);
  });
  it("filters invalid coordinates while keeping valid map points", () => {
    expect(indexPublicCoverageMapRegions([
      { centerLat: Number.NaN, centerLng: 28 },
      { centerLat: 91, centerLng: 28 },
      { centerLat: -26, centerLng: 28 },
    ]).map(x => x.index)).toEqual([2]);
  });
  it("does not truncate the configured region list or confuse pin index with list index", () => {
    const source = readFileSync("components/public-v2/maps/PublicCoverageMap.tsx", "utf8");
    expect(source).toContain("regions.map((region, idx)");
    expect(source).not.toContain("regions.slice(0, 6)");
    expect(source).toContain("onSelectIndex(index)");
    expect(source).toContain("item.index === selectedIndex");
    expect(source).toContain("useMemo(() => indexPublicCoverageMapRegions(regions), [regions])");
  });
});
