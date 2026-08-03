import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { StoreEarningReconciliationListQuerySchema } from "@/lib/validation/store-earnings";

const list = readFileSync(join(process.cwd(), "app/api/admin/store-earning-reconciliation/route.ts"), "utf8");
const detail = readFileSync(join(process.cwd(), "app/api/admin/store-earning-reconciliation/[id]/route.ts"), "utf8");
const permission = readFileSync(join(process.cwd(), "lib/store-earnings/finance-permission.ts"), "utf8");

describe("store earning reconciliation APIs", () => {
  it("requires exact reconcile permission and explicit-DENY evaluation", () => { expect(`${list}\n${detail}`).toMatch(/PERMISSIONS\.STORE_EARNINGS_RECONCILE/); expect(permission).toMatch(/effect:\s*"DENY"/); });
  it("supports strict reason/status pagination filters", () => expect(StoreEarningReconciliationListQuerySchema.safeParse({ page: 1, pageSize: 20, status: "OPEN", reason: "REFUND_AFTER_RELEASE" }).success).toBe(true));
  it("has no manual financial mutation endpoint", () => expect(`${list}\n${detail}`).not.toMatch(/export async function (?:POST|PUT|PATCH|DELETE)|balance|amount/));
});
