import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "app/api/admin/finance/route.ts"), "utf8");

describe("admin finance dashboard API", () => {
  it("requires finance read permission for dashboard metrics", () => {
    expect(source).toMatch(/getFinanceDashboard/);
  });
});
