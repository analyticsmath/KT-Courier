import { describe, it, expect, vi } from "vitest";
import { withSerializableRetry, isSerializableConcurrencyError } from "../../lib/db/serializable-retry";

describe("withSerializableRetry Concurrency Helper", () => {
  it("recognizes serialization failures, deadlocks, and P2034 errors as retryable", () => {
    expect(isSerializableConcurrencyError({ code: "P2034" })).toBe(true);
    expect(isSerializableConcurrencyError({ meta: { code: "40001" } })).toBe(true);
    expect(isSerializableConcurrencyError({ message: "could not serialize access due to concurrent update" })).toBe(true);
    expect(isSerializableConcurrencyError({ meta: { code: "40P01" } })).toBe(true);
    expect(isSerializableConcurrencyError({ message: "deadlock detected" })).toBe(true);

    expect(isSerializableConcurrencyError(new Error("Generic error"))).toBe(false);
    expect(isSerializableConcurrencyError({ code: "P2002" })).toBe(false);
    expect(isSerializableConcurrencyError(null)).toBe(false);
  });

  it("succeeds on first attempt without retry when no error occurs", async () => {
    const fn = vi.fn(async () => "ok");
    const result = await withSerializableRetry(fn, { maxRetries: 3 });
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries on serialization conflict and succeeds", async () => {
    let callCount = 0;
    const fn = vi.fn(async () => {
      callCount += 1;
      if (callCount === 1) {
        const err = new Error("could not serialize access due to concurrent update");
        throw err;
      }
      return "recovered";
    });

    const onRetry = vi.fn();
    const result = await withSerializableRetry(fn, {
      maxRetries: 3,
      initialDelayMs: 2,
      enableJitter: false,
      onRetry,
    });

    expect(result).toBe("recovered");
    expect(callCount).toBe(2);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("fails immediately on non-retryable error without retrying", async () => {
    const fn = vi.fn(async () => {
      throw new Error("CART_MUTATION_NOT_ALLOWED");
    });

    const onRetry = vi.fn();
    await expect(
      withSerializableRetry(fn, { maxRetries: 3, onRetry })
    ).rejects.toThrow("CART_MUTATION_NOT_ALLOWED");

    expect(fn).toHaveBeenCalledTimes(1);
    expect(onRetry).not.toHaveBeenCalled();
  });

  it("throws last error when maxRetries is exceeded", async () => {
    const fn = vi.fn(async () => {
      const err = new Error("40001 serialization failure");
      throw err;
    });

    const onRetry = vi.fn();
    await expect(
      withSerializableRetry(fn, {
        maxRetries: 2,
        initialDelayMs: 2,
        enableJitter: false,
        onRetry,
      })
    ).rejects.toThrow("40001 serialization failure");

    expect(fn).toHaveBeenCalledTimes(3); // attempt 0, 1, 2
    expect(onRetry).toHaveBeenCalledTimes(2);
  });
});
