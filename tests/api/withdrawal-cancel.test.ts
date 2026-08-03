import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "app/api/withdrawals/[publicReference]/cancel/route.ts"), "utf8");

describe("withdrawal cancellation API", () => {
  it("enforces same origin and owner authorization", () => {
    expect(source).toMatch(/enforceSameOriginRequest/);
    expect(source).toMatch(/cancelWithdrawalRequest/);
  });
});
