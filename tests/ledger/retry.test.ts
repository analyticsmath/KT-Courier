import { describe, expect, it, vi } from "vitest";
import { LedgerError } from "@/lib/ledger/errors";
import { withLedgerRetry } from "@/lib/ledger/retry";

describe("ledger retry policy", () => {
  it.each(["P2034", "40001", "40P01"])("retries recognized concurrency code %s", async (code) => {
    const operation = vi.fn().mockRejectedValueOnce({ code }).mockResolvedValue("ok");
    await expect(withLedgerRetry(operation)).resolves.toBe("ok");
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it("bounds retries", async () => {
    const operation = vi.fn().mockRejectedValue({ code: "40001" });
    await expect(withLedgerRetry(operation, 2)).rejects.toMatchObject({ code: "40001" });
    expect(operation).toHaveBeenCalledTimes(3);
  });

  it("does not retry semantic errors", async () => {
    const operation = vi.fn().mockRejectedValue(new LedgerError("LEDGER_INSUFFICIENT_BALANCE", "no"));
    await expect(withLedgerRetry(operation)).rejects.toMatchObject({ code: "LEDGER_INSUFFICIENT_BALANCE" });
    expect(operation).toHaveBeenCalledTimes(1);
  });
});
