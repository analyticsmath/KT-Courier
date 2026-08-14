import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { hasPrismaField } from "./prisma-source-audit-helpers";

const read = (file: string) => readFileSync(path.join(process.cwd(), file), "utf8");

describe("managed marketing channel placement authority", () => {
  it("maps configured channels to either a canonical on-platform placement or a manual external placement", () => {
    const schema = read("prisma/schema.prisma");
    const migration = read("prisma/migrations/20260811173000_phase_b_managed_marketing_channel_placement_authority/migration.sql");
    expect(schema).toMatch(/model ManagedMarketingChannelPlacement/);
    expect(schema).toMatch(/ON_PLATFORM[\s\S]*MANUAL_EXTERNAL/);
    expect(hasPrismaField(schema, "ManagedMarketingChannelPlacement", "advertisingPlacementDefinition", "AdvertisingPlacementDefinition?")).toBe(true);
    expect(migration).toMatch(/ManagedMarketingChannelPlacement_kind_target/);
  });

  it("keeps placement target validation, exact permissions, audit evidence and active-selection protection in the canonical service", () => {
    const service = read("lib/advertising/managed-marketing.service.ts");
    const routes = read("lib/advertising/managed-marketing-admin-route.ts");
    expect(service).toMatch(/MANAGED_MARKETING_PLACEMENTS_MANAGE/);
    expect(service).toMatch(/resolvePlacementTarget/);
    expect(service).toMatch(/MARKETING_ON_PLATFORM_PLACEMENT_UNAVAILABLE/);
    expect(service).toMatch(/MANAGED_MARKETING_PLACEMENT_UNAVAILABLE/);
    expect(service).toMatch(/ManagedMarketingChannelPlacement/);
    expect(routes).toMatch(/Placement target does not match its kind/);
  });
});
