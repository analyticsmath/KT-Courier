import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "app/api/admin/withdrawal-reconciliation/route.ts"), "utf8");

describe("admin withdrawal reconciliation API", () => {
  it("requires read permission for reconciliation scanning", () => {
    expect(source).toMatch(/requireAdminApiPermission/);
  });
});
