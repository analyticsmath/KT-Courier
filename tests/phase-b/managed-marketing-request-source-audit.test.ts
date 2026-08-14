import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { hasPrismaField } from "./prisma-source-audit-helpers";

const read = (file: string) => readFileSync(path.join(process.cwd(), file), "utf8");

describe("managed marketing request and creative authority", () => {
  it("models immutable request package evidence, selected configured channels/placements, and one typed media target", () => {
    const schema = read("prisma/schema.prisma");
    const migration = read("prisma/migrations/20260811174000_phase_b_managed_marketing_request_media/migration.sql");
    expect(schema).toMatch(/model ManagedMarketingRequestChannel/);
    expect(schema).toMatch(/model ManagedMarketingRequestPlacement/);
    expect(schema).toMatch(/model ManagedMarketingRequestCreative/);
    expect(hasPrismaField(schema, "ManagedMarketingRequest", "submittedAt", "DateTime?")).toBe(true);
    expect(migration).toMatch(/ManagedMarketingRequestCreative_source_target/);
    expect(migration).toMatch(/ManagedMarketingRequestChannel_request_channel_key/);
  });

  it("keeps ownership, draft locking, configured selection, private/public creative entitlement and submission in the service", () => {
    const service = read("lib/advertising/managed-marketing.service.ts");
    expect(service).toMatch(/getStoreForUser/);
    expect(service).toMatch(/validateConfiguration/);
    expect(service).toMatch(/selectActivePackageVersion/);
    expect(service).toMatch(/selectActivePlacement/);
    expect(service).toMatch(/validateCreativeEntitlement/);
    expect(service).toMatch(/assertEditable/);
    expect(service).toMatch(/submittedAt: new Date\(\)/);
    expect(service).toMatch(/MANAGED_MARKETING_CREATIVE_FORBIDDEN/);
  });

  it("exposes thin store-owned routes with distributed-required mutation policies", () => {
    const routes = read("lib/advertising/managed-marketing-store-route.ts");
    const createRoute = read("app/api/store/managed-marketing/requests/route.ts");
    const rateLimit = read("lib/security/rate-limit.ts");
    expect(createRoute).toMatch(/MANAGED_MARKETING_REQUESTS_CREATE_OWN/);
    expect(routes).toMatch(/enforceSameOriginRequest/);
    expect(routes).toMatch(/checkIpRateLimit/);
    expect(rateLimit).toMatch(/MANAGED_MARKETING_REQUEST_CREATE[\s\S]*distributedRequired: true/);
    expect(rateLimit).toMatch(/MANAGED_MARKETING_CREATIVE_ATTACH[\s\S]*distributedRequired: true/);
  });
});
