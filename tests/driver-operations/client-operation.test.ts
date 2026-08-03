import { describe, expect, it } from "vitest";
import { createDriverOperationIdStore } from "@/lib/driver-operations/client-operation";

describe("driver mobile operation IDs", () => {
  it("retains an ID for a network retry and clears after confirmed success", () => {
    let sequence = 0;
    const store = createDriverOperationIdStore(() => `id-${++sequence}`);
    expect(store.get("pickup", { count: 1 })).toBe("id-1");
    expect(store.get("pickup", { count: 1 })).toBe("id-1");
    store.clear("pickup");
    expect(store.get("pickup", { count: 1 })).toBe("id-2");
  });
  it("uses a new ID after material payload changes", () => {
    let sequence = 0;
    const store = createDriverOperationIdStore(() => `id-${++sequence}`);
    expect(store.get("attempt", { reason: "ACCESS_ISSUE" })).not.toBe(store.get("attempt", { reason: "RECIPIENT_UNAVAILABLE" }));
  });
});
