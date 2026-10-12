import { describe, expect, it } from "vitest";
import { storeOrderRequestHash } from "@/lib/store-orders/request-hash";
describe("store order request identity", () => {
  it("retains identity across nested object property ordering", () => {
    expect(storeOrderRequestHash("decide", { action: "decide", operationId: "same", choice: { reference: "owned", quantity: 1 } })).toBe(storeOrderRequestHash("decide", { choice: { quantity: 1, reference: "owned" }, operationId: "same", action: "decide" }));
  });
  it("distinguishes changed action, values and ordered choices", () => {
    const body = { operationId: "same", choices: ["a", "b"], quantity: 1 };
    const source = storeOrderRequestHash("decide", body);
    expect(storeOrderRequestHash("cancel", body)).not.toBe(source);
    expect(storeOrderRequestHash("decide", { ...body, quantity: 2 })).not.toBe(source);
    expect(storeOrderRequestHash("decide", { ...body, choices: ["b", "a"] })).not.toBe(source);
  });
});
