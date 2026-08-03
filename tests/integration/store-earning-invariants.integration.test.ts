import { describe, expect, it } from "vitest";
import { isTerminalStoreEarningStatus } from "@/lib/store-earnings/store-earning-state-machine";

describe("store earning database invariants", () => {
  it("correctly identifies terminal store earning statuses", () => {
    expect(isTerminalStoreEarningStatus("RELEASED")).toBe(true);
    expect(isTerminalStoreEarningStatus("ACCRUED")).toBe(false);
  });
});
