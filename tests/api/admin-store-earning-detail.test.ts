import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const route = readFileSync(join(process.cwd(), "app/api/admin/store-earnings/[id]/route.ts"), "utf8");
const service = readFileSync(join(process.cwd(), "lib/services/store-earning-query.service.ts"), "utf8");

describe("finance store earning detail API", () => {
  it("requires exact read permission and returns 404 for invalid or missing IDs", () => { expect(route).toMatch(/PERMISSIONS\.STORE_EARNINGS_READ/); expect(route).toMatch(/404/); });
  it("returns commission, ledger, refund, history, and reconciliation evidence with money strings", () => { for (const token of ["journals", "commissionCharges", "refunds", "history", "reconciliation", "formatStoreEarningMoney"]) expect(service).toContain(token); });
  it("is read only", () => expect(route).not.toMatch(/export async function (?:POST|PUT|PATCH|DELETE)/));
});
