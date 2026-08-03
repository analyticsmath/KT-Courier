import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "app/api/admin/withdrawals/route.ts"), "utf8");

describe("admin withdrawals API", () => {
  it("requires exact admin permission and safe list query", () => {
    expect(source).toMatch(/requireAdminApiPermission/);
    expect(source).toMatch(/listFinanceWithdrawals/);
  });
});
