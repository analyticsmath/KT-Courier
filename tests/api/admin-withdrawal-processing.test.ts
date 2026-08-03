import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "app/api/admin/withdrawals/[id]/start-processing/route.ts"), "utf8");

describe("admin withdrawal processing API", () => {
  it("requires processing permission", () => {
    expect(source).toMatch(/requireAdminApiPermission/);
    expect(source).toMatch(/startWithdrawalPayout/);
  });
});
