import { describe, expect, it, vi } from "vitest";
import { withDispatchRetry } from "@/lib/dispatch/retry";
import { DispatchError } from "@/lib/dispatch/errors";

describe("dispatch retry", () => {
  it("retries recognized serialization conflicts but not business errors", async () => {
    const retry = vi.fn().mockRejectedValueOnce({ code: "P2034" }).mockResolvedValue("ok");
    await expect(withDispatchRetry(retry, 1)).resolves.toBe("ok");
    expect(retry).toHaveBeenCalledTimes(2);
    const business = vi.fn().mockRejectedValue(new DispatchError("X", "no"));
    await expect(withDispatchRetry(business)).rejects.toThrow("no");
    expect(business).toHaveBeenCalledTimes(1);
  });
});
