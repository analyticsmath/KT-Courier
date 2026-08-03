import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const surface = readFileSync(join(root, "components/promoters/PromoterSurface.tsx"), "utf8");
const promoterPresentation = readFileSync(join(root, "components/protected-v2/promoter/PromoterPages.tsx"), "utf8");
function files(directory: string): string[] {
  const absolute = join(root, directory);
  return readdirSync(absolute, { withFileTypes: true }).flatMap((entry) => {
    const file = join(absolute, entry.name);
    return entry.isDirectory() ? files(join(directory, entry.name)) : entry.name.endsWith("page.tsx") ? [file] : [];
  });
}

describe("Phase 25 promoter and admin component contracts", () => {
  it("distinguishes loading, empty, populated, denied, locked, unavailable, error, and reconciliation states", () => {
    for (const state of ["loading", "empty", "ready", "denied", "locked", "error", "reconciliation"]) expect(surface).toContain(state);
    expect(surface).toMatch(/Reconciliation required/);
  });
  it("shows distinct source-backed promoter metrics", () => {
    for (const metric of ["visits", "valid touches", "attributed subjects", "pending qualifications", "qualified conversions", "held earnings", "payable earnings", "available funds", "withdrawn earnings", "reversals"]) expect(surface.toLowerCase()).toContain(metric);
  });
  it("contains privacy and commercial disclosures", () => {
    expect(surface).toMatch(/do not include customer identity, payment, address/);
    expect(surface).toMatch(/Financial edits are unavailable/);
    expect(surface).toMatch(/promoter operations/i);
  });
  it("retains the legacy Phase 25 surface while R17 server-renders promoter routes", () => {
    expect(surface).not.toMatch(/sample|placeholder|Customer Name|customer@example/i);
    expect(promoterPresentation).toMatch(/PromoterOverviewPage/);
    expect(promoterPresentation).not.toMatch(/JSON\.stringify\(data/);
    const promoterPages = files("app/(account)/promoter");
    const adminPages = files("app/(admin)/admin").filter((file) => file.includes("promoter"));
    expect(promoterPages.length).toBeGreaterThan(0);
    expect(adminPages.length).toBeGreaterThan(0);
    expect(promoterPages.every((file) => !readFileSync(file, "utf8").includes("PromoterSurface"))).toBe(true);
    expect(adminPages.every((file) => readFileSync(file, "utf8").includes("PromoterSurface"))).toBe(true);
  });
  it("does not claim visits guarantee earnings or approval establishes employment", () => {
    expect(surface).not.toMatch(/guarantee earnings|establishes employment|employee status/i);
  });
});
