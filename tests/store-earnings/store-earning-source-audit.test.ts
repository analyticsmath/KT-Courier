import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const serviceNames = ["store-earning-accrual.service.ts", "store-earning-release.service.ts", "store-earning-reversal.service.ts", "store-earning-refund.service.ts"];
const services = serviceNames.map((name) => readFileSync(join(root, "lib", "services", name), "utf8")).join("\n");

describe("store earning source boundary", () => {
  it("contains no Order or Payment state writer", () => {
    expect(services).not.toMatch(/\b(?:tx\.)?order\.(?:update|updateMany|upsert|delete)/);
    expect(services).not.toMatch(/\b(?:tx\.)?payment\.(?:update|updateMany|upsert|delete)/);
  });
  it("contains no driver earning or floating-point financial calculation", () => {
    expect(services).not.toMatch(/driver(?:Profile|Earning)|DRIVER_EARNING/);
    expect(services).not.toMatch(/\b(?:Number|parseFloat|Math\.round)\b|\.toFixed\s*\(/);
  });
  it("has no public accrual or store release module", () => {
    expect(() => readFileSync(join(root, "app", "api", "store", "earnings", "accrue", "route.ts"))).toThrow();
    expect(() => readFileSync(join(root, "app", "api", "store", "earnings", "release", "route.ts"))).toThrow();
  });
});
