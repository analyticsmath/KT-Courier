import { afterEach, describe, expect, it, vi } from "vitest";
import { phase5Repository } from "@/lib/operations/phase5-repository";

describe("Phase 5 repository selection", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("fails closed when a non-test runtime requests the memory adapter", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("PHASE5_REPOSITORY_USE_MEMORY", "true");
    vi.stubEnv("PHASE5_REPOSITORY_TEST_MEMORY", "true");
    await expect(phase5Repository.operationalIncident.findMany()).rejects.toThrow(/only permitted for explicitly opted-in unit tests/);
  });

  it("requires the explicit test-memory flag even under NODE_ENV=test", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("PHASE5_REPOSITORY_USE_MEMORY", "true");
    vi.stubEnv("PHASE5_REPOSITORY_TEST_MEMORY", "false");
    await expect(phase5Repository.operationalIncident.findMany()).rejects.toThrow(/only permitted for explicitly opted-in unit tests/);
  });
});
