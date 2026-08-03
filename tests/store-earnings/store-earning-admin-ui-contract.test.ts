import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("finance store earning UI contract", () => {
  const directory = join(process.cwd(), "app", "(admin)", "admin", "store-earnings");
  const list = readFileSync(join(directory, "page.tsx"), "utf8");
  const detail = readFileSync(join(directory, "[id]", "page.tsx"), "utf8");
  const reversal = readFileSync(join(process.cwd(), "components", "store-earnings", "StoreEarningReversalForm.tsx"), "utf8");
  it("uses the exact finance heading and exposes reconciliation evidence", () => expect(`${list}\n${detail}`).toMatch(/Store Earnings/));
  it("has no amount editor or manual release control", () => expect(`${list}\n${detail}\n${reversal}`).not.toMatch(/name=["']amount|Mark released|Release now|Balance adjustment/));
});
