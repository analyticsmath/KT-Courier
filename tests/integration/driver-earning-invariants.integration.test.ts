import { describe, expect, it } from "vitest";
import { isTerminalDriverEarningStatus } from "@/lib/driver-earnings/driver-earning-state-machine";

describe("driver earning database invariants", () => {
  it("correctly identifies terminal driver earning statuses", () => {
    expect(isTerminalDriverEarningStatus("RELEASED")).toBe(true);
    expect(isTerminalDriverEarningStatus("ACCRUED")).toBe(false);
  });
});
