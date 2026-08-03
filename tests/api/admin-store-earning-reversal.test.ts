import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { StoreEarningReversalSchema } from "@/lib/validation/store-earnings";

const route = readFileSync(join(process.cwd(), "app/api/admin/store-earnings/[id]/reverse/route.ts"), "utf8");

describe("finance store earning reversal API", () => {
  it("requires exact reversal permission plus protected admin mutation preparation", () => { expect(route).toMatch(/PERMISSIONS\.STORE_EARNINGS_REVERSE/); expect(route).toMatch(/prepareStoreEarningReversalMutation/); });
  it("accepts only operation, approved reason, and bounded safe note", () => expect(StoreEarningReversalSchema.parse({ operationId: "reverse:operation-1", reasonCode: "SETTLEMENT_INVALIDATED", safeNote: "Reviewed." })).toEqual({ operationId: "reverse:operation-1", reasonCode: "SETTLEMENT_INVALIDATED", safeNote: "Reviewed." }));
  it.each([{ operationId: "reverse:operation-1", reasonCode: "SETTLEMENT_INVALIDATED", amount: "1.00" }, { operationId: "reverse:operation-1", reasonCode: "SETTLEMENT_INVALIDATED", accountId: "account-1" }, { operationId: "reverse:operation-1", reasonCode: "SETTLEMENT_INVALIDATED", status: "REVERSED" }])("rejects financial override input", (payload) => expect(StoreEarningReversalSchema.safeParse(payload).success).toBe(false));
  it("exposes neither delete nor release", () => expect(route).not.toMatch(/export async function (?:DELETE|PUT|PATCH)|releaseStoreEarning/));
});
