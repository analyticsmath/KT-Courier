import { describe, expect, it } from "vitest";
import { StoreStatusUpdateSchema } from "@/lib/validation/admin";
describe("store status changes", () => {
  it.each(["SUSPENDED", "DISABLED"] as const)("requires an audited reason for %s", status => {
    expect(StoreStatusUpdateSchema.safeParse({ status }).success).toBe(false);
    expect(StoreStatusUpdateSchema.safeParse({ status, reason: "Unpaid" }).success).toBe(false);
    expect(StoreStatusUpdateSchema.safeParse({ status, reason: "Repeated unpaid delivery invoices" }).success).toBe(true);
  });
  it("preserves existing approval requests", () => {
    expect(StoreStatusUpdateSchema.safeParse({ status: "ACTIVE" }).success).toBe(true);
  });
  it("rejects arbitrary fields", () => {
    expect(StoreStatusUpdateSchema.safeParse({ status: "DISABLED", reason: "Repeated unpaid delivery invoices", userId: "victim" }).success).toBe(false);
  });
});
