import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const route = readFileSync(join(process.cwd(), "app/api/store/earnings/summary/route.ts"), "utf8");
const service = readFileSync(join(process.cwd(), "lib/services/store-earning-summary.service.ts"), "utf8");

describe("store earning summary API", () => {
  it("requires active store authentication and delegates ownership to the summary service", () => { expect(route).toMatch(/user\.role !== "STORE"/); expect(route).toMatch(/getStoreEarningSummaryForOwner\(user\.id\)/); expect(service).toMatch(/ownerUserId:\s*userId/); });
  it("returns formatted money strings without account IDs or customer PII", () => { expect(service).toMatch(/formatStoreEarningMoney/); expect(route).not.toMatch(/payableAccountId|walletId|customerEmail|customerPhone/); });
  it("has no mutation method", () => expect(route).not.toMatch(/export async function (?:POST|PUT|PATCH|DELETE)/));
});
