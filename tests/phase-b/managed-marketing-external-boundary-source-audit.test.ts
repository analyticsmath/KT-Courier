import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (file: string) => readFileSync(path.join(process.cwd(), file), "utf8");

describe("managed external marketing boundary", () => {
  it("uses the existing request execution mode and provider configuration authority without another advertising workflow", () => {
    const schema = read("prisma/schema.prisma");
    const service = read("lib/advertising/managed-marketing.service.ts");
    expect(schema).toMatch(/enum ManagedMarketingExecutionMode[\s\S]*MANUAL[\s\S]*AUTOMATED_PROVIDER/);
    expect(schema).toMatch(/model ManagedMarketingChannelConfiguration[\s\S]*automatedProviderEnabled[\s\S]*providerConfigurationReference/);
    expect(service).toMatch(/executionMode: ManagedMarketingExecutionMode/);
    expect(service).toMatch(/getProviderConfiguration/);
    expect(service).toMatch(/AUTOMATED_PROVIDER_RUNTIME_AVAILABLE = false/);
  });

  it("makes manual execution selectable and truthfully fails automated publishing, disabled channels, and unsupported modes", () => {
    const service = read("lib/advertising/managed-marketing.service.ts");
    const storeRoute = read("lib/advertising/managed-marketing-store-route.ts");
    expect(storeRoute).toMatch(/executionMode: z\.enum\(\["MANUAL", "AUTOMATED_PROVIDER"\]\)\.default\("MANUAL"\)/);
    expect(service).toMatch(/MANAGED_MARKETING_PROVIDER_NOT_CONFIGURED/);
    expect(service).toMatch(/MANAGED_MARKETING_AUTOMATION_NOT_AVAILABLE/);
    expect(service).toMatch(/MANAGED_MARKETING_CHANNEL_DISABLED/);
    expect(service).toMatch(/MANAGED_MARKETING_EXECUTION_MODE_NOT_SUPPORTED/);
    expect(service).toMatch(/MANUAL_RUN_RECORDED/);
  });

  it("exposes only safe capability state and preserves immutable execution/performance evidence", () => {
    const service = read("lib/advertising/managed-marketing.service.ts");
    const capabilityRoute = read("app/api/store/managed-marketing/execution-capabilities/route.ts");
    expect(service).toMatch(/safeChannelCapability/);
    expect(service).toMatch(/automatedProviderStatus/);
    expect(service).not.toMatch(/providerConfigurationReference:\s*channel/);
    expect(service).toMatch(/executionMode }/);
    expect(service).toMatch(/PERFORMANCE_RECORDED/);
    expect(capabilityRoute).toMatch(/listExecutionCapabilities/);
    expect(capabilityRoute).toMatch(/MANAGED_MARKETING_REQUESTS_CREATE_OWN/);
  });
});
