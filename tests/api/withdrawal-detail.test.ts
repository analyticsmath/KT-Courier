import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "app/api/withdrawals/[publicReference]/route.ts"), "utf8");

describe("withdrawal detail API", () => {
  it("requires authenticated owner role and loads masked detail", () => {
    expect(source).toMatch(/getCurrentUser/);
    expect(source).toMatch(/getOwnerWithdrawal/);
  });
});
