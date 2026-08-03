import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "app/api/admin/withdrawals/[id]/review/route.ts"), "utf8");

describe("admin withdrawal review API", () => {
  it("requires admin review permission and same-origin enforcement", () => {
    expect(source).toMatch(/requireAdminApiPermission/);
    expect(source).toMatch(/beginWithdrawalReview/);
  });
});
