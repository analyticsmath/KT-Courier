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

  it("retries Prisma-wrapper-style deadlock with NO top-level code (message contains 40P01 / deadlock detected)", async () => {
    const deadlockError = new Error(
      'Database error: PostgresError { code: "40P01", message: "deadlock detected" }'
    );
    expect((deadlockError as { code?: string }).code).toBeUndefined();

    const op = vi.fn().mockRejectedValueOnce(deadlockError).mockResolvedValue("deadlock-resolved");
    await expect(withDispatchRetry(op, 2)).resolves.toBe("deadlock-resolved");
    expect(op).toHaveBeenCalledTimes(2);
  });

  it("retries when meta.code is 40P01", async () => {
    const metaError = {
      name: "PrismaClientKnownRequestError",
      meta: { code: "40P01" },
      message: "Transaction failed",
    };
    const op = vi.fn().mockRejectedValueOnce(metaError).mockResolvedValue("meta-resolved");
    await expect(withDispatchRetry(op, 2)).resolves.toBe("meta-resolved");
    expect(op).toHaveBeenCalledTimes(2);
  });

  it("retries message-only 40001 / serialization failure", async () => {
    const serializationError = new Error(
      "could not serialize access due to concurrent update (SQLSTATE 40001)"
    );
    const op = vi.fn().mockRejectedValueOnce(serializationError).mockResolvedValue("serial-resolved");
    await expect(withDispatchRetry(op, 2)).resolves.toBe("serial-resolved");
    expect(op).toHaveBeenCalledTimes(2);
  });

  it("does NOT retry P2002 unique constraint violation", async () => {
    const uniqueConstraintError = { code: "P2002", message: "Unique constraint failed" };
    const op = vi.fn().mockRejectedValue(uniqueConstraintError);
    await expect(withDispatchRetry(op, 3)).rejects.toEqual(uniqueConstraintError);
    expect(op).toHaveBeenCalledTimes(1);
  });

  it("does NOT retry generic validation or application errors", async () => {
    const genericError = new TypeError("Cannot read properties of undefined");
    const op = vi.fn().mockRejectedValue(genericError);
    await expect(withDispatchRetry(op, 3)).rejects.toThrow(genericError);
    expect(op).toHaveBeenCalledTimes(1);
  });
});
