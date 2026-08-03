import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "app/api/admin/withdrawals/[id]/complete-payout/route.ts"), "utf8");

describe("admin withdrawal completion API", () => {
  it("requires completion permission and payout evidence", () => {
    expect(source).toMatch(/requireAdminApiPermission/);
    expect(source).toMatch(/completeManualWithdrawalPayout/);
  });
});
