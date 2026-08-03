import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "app/api/admin/payout-destinations/route.ts"), "utf8");

describe("admin payout destinations API", () => {
  it("requires admin permission for destination audit", () => {
    expect(source).toMatch(/requireAdminApiPermission/);
  });
});
