import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("store earning UI contract", () => {
  const list = readFileSync(join(process.cwd(), "app", "(store)", "store", "earnings", "page.tsx"), "utf8");
  const detail = readFileSync(join(process.cwd(), "app", "(store)", "store", "earnings", "[publicReference]", "page.tsx"), "utf8");
  it("uses the exact heading and safe entitlement fields", () => expect(`${list}\n${detail}`).toMatch(/Earnings/));
  it("exposes no mutation control, customer PII, or account identifier", () => expect(`${list}\n${detail}`).not.toMatch(/Reverse|Release earning|Create earning|customerEmail|customerPhone|payableAccountId|walletId/));
});
