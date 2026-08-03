import { describe, expect, it } from "vitest";
import { exactKeys, integer, text } from "@/lib/store-orders/api-policy";
describe("store-order API contract", () => {
  it("rejects extra client-controlled fields such as price or derived status", () => {
    expect(() => exactKeys({ action: "accept", operationId: "x", price: "0.01" }, ["action", "operationId"])).toThrow("Invalid request body");
    expect(() => exactKeys({ action: "ready", operationId: "x", derivedStatus: "DELIVERED" }, ["action", "operationId"])).toThrow("Invalid request body");
  });
  it("requires strictly typed bounded primitive fields", () => {
    expect(() => integer({ quantity: "1" }, "quantity")).toThrow("Invalid request body");
    expect(text({ operationId: "valid-operation-id" }, "operationId", 12, 160)).toBe("valid-operation-id");
  });
});
