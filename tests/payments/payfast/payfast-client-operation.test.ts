import { describe, expect, it } from "vitest";
import { createPaymentOperationIdStore } from "@/lib/payments/client-operation";
describe("Payfast client operation IDs", () => {
  it("retains one ID across a logical network retry and rotates for changed meaning", () => { let count = 0; const store = createPaymentOperationIdStore(() => `id-${++count}`); expect(store.get("prepare", "order-1")).toBe("id-1"); expect(store.get("prepare", "order-1")).toBe("id-1"); expect(store.get("prepare", "order-2")).toBe("id-2"); });
  it("keeps preparation and checkout operations independent and clears after success", () => { let count = 0; const store = createPaymentOperationIdStore(() => `id-${++count}`); const prepare = store.get("prepare", "order"); const checkout = store.get("checkout", "payment"); expect(checkout).not.toBe(prepare); store.clear("checkout"); expect(store.get("checkout", "payment")).not.toBe(checkout); });
});
