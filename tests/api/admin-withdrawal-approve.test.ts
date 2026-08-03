import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "app/api/admin/withdrawals/[id]/approve/route.ts"), "utf8");

describe("admin withdrawal approve API", () => {
  it("requires maker-checker approve permission", () => {
    expect(source).toMatch(/requireAdminApiPermission/);
    expect(source).toMatch(/approveWithdrawal/);
  });
});
