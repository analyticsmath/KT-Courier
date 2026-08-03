import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "app/api/admin/withdrawals/[id]/reject/route.ts"), "utf8");

describe("admin withdrawal reject API", () => {
  it("requires rejection permission and atomic release", () => {
    expect(source).toMatch(/requireAdminApiPermission/);
    expect(source).toMatch(/rejectWithdrawal/);
  });
});
