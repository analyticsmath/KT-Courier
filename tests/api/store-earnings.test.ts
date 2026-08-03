import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { StoreEarningListQuerySchema } from "@/lib/validation/store-earnings";

const source = readFileSync(join(process.cwd(), "app/api/store/earnings/route.ts"), "utf8");

describe("store earnings list API", () => {
  it("requires authenticated active STORE ownership", () => { expect(source).toMatch(/getCurrentUser/); expect(source).toMatch(/user\.role !== "STORE"/); expect(source).toMatch(/user\.status !== "ACTIVE"/); });
  it("supports strict pagination and filters", () => { expect(StoreEarningListQuerySchema.parse({})).toMatchObject({ page: 1, pageSize: 20 }); expect(StoreEarningListQuerySchema.safeParse({ page: 1, pageSize: 101 }).success).toBe(false); expect(StoreEarningListQuerySchema.safeParse({ page: 1, pageSize: 20, unknown: "x" }).success).toBe(false); });
  it("exports GET only and therefore has no store mutation", () => { expect(source).toMatch(/export async function GET/); expect(source).not.toMatch(/export async function (?:POST|PUT|PATCH|DELETE)/); });
});
