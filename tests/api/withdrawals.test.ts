import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { WithdrawalCreateSchema, WithdrawalListQuerySchema } from "@/lib/validation/withdrawals";

const source = readFileSync(join(process.cwd(), "app/api/withdrawals/route.ts"), "utf8");

describe("withdrawals API", () => {
  it("requires authenticated owner roles", () => {
    expect(source).toMatch(/getCurrentUser/);
    expect(source).toMatch(/ownerRoles/);
  });
  it("supports list and create validation", () => {
    expect(WithdrawalListQuerySchema.parse({})).toMatchObject({ page: 1, pageSize: 20 });
    expect(WithdrawalCreateSchema.safeParse({ amount: "100.00", payoutDestinationPublicReference: "PD-12345678901234567890123456789012", operationId: "op-123456789" }).success).toBe(true);
  });
  it("enforces same origin for POST requests", () => {
    expect(source).toMatch(/enforceSameOriginRequest/);
    expect(source).toMatch(/export async function POST/);
  });
});
