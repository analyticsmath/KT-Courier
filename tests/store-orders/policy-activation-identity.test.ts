import { describe, expect, it } from "vitest";
import { assertDistinctStoreOrderPolicyActivator } from "@/lib/store-orders/operational-policy-approval";

describe("store-order policy activation separation of duties", () => {
  it("rejects the policy approver acting as activator", () => {
    expect(() => assertDistinctStoreOrderPolicyActivator("admin-1", "admin-1")).toThrow();
  });
  it("rejects policies with no recorded approver or no authenticated activator", () => {
    expect(() => assertDistinctStoreOrderPolicyActivator(null, "admin-2")).toThrow();
    expect(() => assertDistinctStoreOrderPolicyActivator("admin-1", "")).toThrow();
  });
  it("allows another distinct authorized user to activate a reviewed version", () => {
    expect(() => assertDistinctStoreOrderPolicyActivator("admin-1", "admin-2")).not.toThrow();
  });
});
