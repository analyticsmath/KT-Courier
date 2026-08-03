import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FinanceStoreEarningListQuerySchema } from "@/lib/validation/store-earnings";

const route = readFileSync(join(process.cwd(), "app/api/admin/store-earnings/route.ts"), "utf8");
const permission = readFileSync(join(process.cwd(), "lib/store-earnings/finance-permission.ts"), "utf8");

describe("finance store earnings list API", () => {
  it("requires the exact read permission and honors explicit DENY", () => { expect(route).toMatch(/PERMISSIONS\.STORE_EARNINGS_READ/); expect(permission).toMatch(/effect:\s*"DENY"/); expect(permission).toMatch(/if \(await explicitlyDenied/); });
  it("accepts strict finance filters and bounded pagination", () => { expect(FinanceStoreEarningListQuerySchema.safeParse({ page: 2, pageSize: 50, reconciliation: "true", storeReference: "STORE" }).success).toBe(true); expect(FinanceStoreEarningListQuerySchema.safeParse({ page: 1, pageSize: 20, amount: "1.00" }).success).toBe(false); });
  it("has no create or delete route method", () => expect(route).not.toMatch(/export async function (?:POST|PUT|PATCH|DELETE)/));
});
