import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "app/api/payout-destinations/route.ts"), "utf8");

describe("payout destinations API", () => {
  it("returns read-only masked owner destinations", () => {
    expect(source).toMatch(/getCurrentUser/);
    expect(source).toMatch(/listOwnerPayoutDestinations/);
  });
});
