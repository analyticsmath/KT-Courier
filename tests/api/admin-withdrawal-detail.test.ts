import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "app/api/admin/withdrawals/[id]/route.ts"), "utf8");

describe("admin withdrawal detail API", () => {
  it("requires admin permission and projects detail DTO", () => {
    expect(source).toMatch(/requireAdminApiPermission/);
    expect(source).toMatch(/getFinanceWithdrawal/);
  });
});
