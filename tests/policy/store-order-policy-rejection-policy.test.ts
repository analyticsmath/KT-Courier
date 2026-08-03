import { describe, expect, it } from "vitest";
import { rejectStoreOrderOperationalPolicy } from "@/lib/store-orders/operational-policy.service";

describe("store-order policy rejection contract", () => {
  it("requires an uppercase structured rejection reason before persistence", async () => {
    await expect(rejectStoreOrderOperationalPolicy({ publicReference: "sopolicy_x", rejectedByUserId: "admin_x", reasonCode: "bad reason", operationId: "policy-reject-operation-0001" })).rejects.toMatchObject({ code: "STORE_ORDER_POLICY_INVALID" });
  });

  it("requires a bounded operation identity before persistence", async () => {
    await expect(rejectStoreOrderOperationalPolicy({ publicReference: "sopolicy_x", rejectedByUserId: "admin_x", reasonCode: "MISSING_EVIDENCE", operationId: "short" })).rejects.toMatchObject({ code: "STORE_ORDER_POLICY_INVALID" });
  });
});
