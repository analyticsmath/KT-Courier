import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ $transaction: vi.fn() }));
vi.mock("@/lib/db/prisma", () => ({ prisma: db }));
import { startStoreOrderPreparation } from "@/lib/store-orders/store-order.service";

const input = { storeOrderReference: "store-order-1", actorUserId: "actor-1", operationId: "operation-123456", requestHash: "a".repeat(64) };

beforeEach(() => { db.$transaction.mockReset(); });

describe("store order preparation transaction conflicts", () => {
  it("retries a serialization conflict without changing the operation receipt", async () => {
    const receipt = { storeOrderReference: input.storeOrderReference, preparationStatus: "PREPARING", replayed: false };
    db.$transaction.mockRejectedValueOnce({ code: "P2034" }).mockResolvedValueOnce(receipt);
    await expect(startStoreOrderPreparation(input)).resolves.toEqual(receipt);
    expect(db.$transaction).toHaveBeenCalledTimes(2);
  });

  it("does not retry an unrelated error", async () => {
    const failure = { code: "P1001" };
    db.$transaction.mockRejectedValue(failure);
    let received: unknown;
    try { await startStoreOrderPreparation(input); } catch (error) { received = error; }
    expect(received).toBe(failure);
    expect(db.$transaction).toHaveBeenCalledTimes(1);
  });
});
