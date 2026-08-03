import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { StoreEarningPublicReferenceParamsSchema } from "@/lib/validation/store-earnings";

const route = readFileSync(join(process.cwd(), "app/api/store/earnings/[publicReference]/route.ts"), "utf8");
const service = readFileSync(join(process.cwd(), "lib/services/store-earning-query.service.ts"), "utf8");

describe("store earning detail API", () => {
  it("validates an opaque public reference and awaits Next 16 params", () => { expect(StoreEarningPublicReferenceParamsSchema.safeParse({ publicReference: `SE-${"A".repeat(32)}` }).success).toBe(true); expect(route).toMatch(/params:\s*Promise/); expect(route).toMatch(/await params/); });
  it("scopes detail lookup by the owner's store to deny cross-store access", () => expect(service).toMatch(/publicReference, storeId:\s*store\.id/));
  it("returns read-only safe history with no account/customer fields", () => { expect(route).not.toMatch(/export async function (?:POST|PUT|PATCH|DELETE)/); const detailSection = service.slice(service.indexOf("function storeDetail"), service.indexOf("function financeItem")); expect(detailSection).not.toMatch(/payableAccountId|walletId|customer/); });
});
