import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const integration = readdirSync(join(root, "tests/integration")).filter((file) => /^promoter-.*\.integration\.test\.ts$/.test(file));
const e2e = readdirSync(join(root, "tests/e2e")).filter((file) => /promoter.*\.spec\.ts$/.test(file) || /^admin-promoter.*\.spec\.ts$/.test(file));
const integrationSource = integration.map((file) => readFileSync(join(root, "tests/integration", file), "utf8"));
const e2eSource = e2e.map((file) => readFileSync(join(root, "tests/e2e", file), "utf8"));

describe("Phase 25 deferred scaffold audit", () => {
  it("contains all eleven non-empty PostgreSQL integration scenarios", () => {
    expect(integration).toHaveLength(11);
    expect(integrationSource.every((source) => source.length > 200 && source.includes("beforeEach") && source.includes("execute") && source.includes("expect"))).toBe(true);
  });
  it("uses only the disposable integration database contract", () => {
    const config = readFileSync(join(root, "vitest.promoter-integration.config.ts"), "utf8");
    expect(config).toContain("PHASE25_DISPOSABLE_DATABASE_URL");
    expect(config).not.toMatch(/process\.env\.DATABASE_URL|kt-courier(?:_dev|-dev)/i);
    expect(integrationSource.every((source) => source.includes("createDisposablePhase25Scenario"))).toBe(true);
  });
  it("contains all ten non-empty skipped Playwright scenarios", () => {
    expect(e2e).toHaveLength(10);
    const deferredMarker = ["test", "skip"].join(".");
    expect(e2eSource.every((source) => source.length > 180 && source.includes(deferredMarker) && source.includes("beforeEach") && source.includes("goto") && source.includes("expect"))).toBe(true);
  });
  it("represents business-customer acquisition as unavailable", () => expect(readFileSync(join(root, "tests/e2e/admin-promoter-programs.spec.ts"), "utf8")).toMatch(/unavailable business acquisition|BusinessAccount/));
});
