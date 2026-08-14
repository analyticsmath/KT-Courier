import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { hasPrismaField } from "./prisma-source-audit-helpers";

const read = (file: string) => readFileSync(path.join(process.cwd(), file), "utf8");

describe("managed marketing lifecycle authority", () => {
  it("models paused, ended and completed lifecycle evidence on the existing managed-marketing request", () => {
    const schema = read("prisma/schema.prisma");
    const migration = read("prisma/migrations/20260811175000_phase_b_managed_marketing_lifecycle_processor/migration.sql");
    expect(schema).toMatch(/ManagedMarketingRequestStatus[\s\S]*SCHEDULED[\s\S]*RUNNING[\s\S]*PAUSED[\s\S]*ENDED[\s\S]*COMPLETED/);
    expect(hasPrismaField(schema, "ManagedMarketingRequest", "pausedAt", "DateTime?")).toBe(true);
    expect(hasPrismaField(schema, "ManagedMarketingRequest", "endedAt", "DateTime?")).toBe(true);
    expect(migration).toMatch(/ADD VALUE IF NOT EXISTS 'PAUSED'/);
    expect(migration).toMatch(/ADD VALUE IF NOT EXISTS 'ENDED'/);
  });

  it("keeps approval-gated lifecycle transitions, manual execution truthfulness, and processor completion in the canonical service", () => {
    const service = read("lib/advertising/managed-marketing.service.ts");
    expect(service).toMatch(/requireApprovedForExecution/);
    expect(service).toMatch(/scheduleRequest/);
    expect(service).toMatch(/runManually/);
    expect(service).toMatch(/pauseRequest/);
    expect(service).toMatch(/endRequest/);
    expect(service).toMatch(/MANAGED_MARKETING_PROVIDER_UNAVAILABLE/);
    expect(service).toMatch(/applyLifecycleTransition/);
    expect(service).toMatch(/MANAGED_MARKETING_IDEMPOTENCY_CONFLICT/);
    expect(service).toMatch(/PROCESSOR_COMPLETED/);
    expect(service).toMatch(/processorOperationId/);
  });

  it("exposes exact-permission operations and a registered leased lifecycle processor", () => {
    const permissions = read("lib/auth/permission-keys.ts");
    const registry = read("lib/processors/processor-registry.ts");
    const processor = read("lib/processors/processor-service.ts");
    const schedule = read("app/api/admin/managed-marketing/requests/[reference]/schedule/route.ts");
    const run = read("app/api/admin/managed-marketing/requests/[reference]/run/route.ts");
    const pause = read("app/api/admin/managed-marketing/requests/[reference]/pause/route.ts");
    const end = read("app/api/admin/managed-marketing/requests/[reference]/end/route.ts");
    expect(permissions).toMatch(/MANAGED_MARKETING_REQUESTS_SCHEDULE/);
    expect(permissions).toMatch(/MANAGED_MARKETING_REQUESTS_EXECUTE/);
    expect(permissions).toMatch(/MANAGED_MARKETING_REQUESTS_PAUSE/);
    expect(permissions).toMatch(/MANAGED_MARKETING_REQUESTS_END/);
    expect(schedule).toMatch(/MANAGED_MARKETING_REQUESTS_SCHEDULE/);
    expect(run).toMatch(/MANAGED_MARKETING_REQUESTS_EXECUTE/);
    expect(pause).toMatch(/MANAGED_MARKETING_REQUESTS_PAUSE/);
    expect(end).toMatch(/MANAGED_MARKETING_REQUESTS_END/);
    expect(registry).toMatch(/process-managed-marketing-lifecycle/);
    expect(registry).toMatch(/leaseRequired: true/);
    expect(processor).toMatch(/runLifecycleProcessor/);
  });
});
