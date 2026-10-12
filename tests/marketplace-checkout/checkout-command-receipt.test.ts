import { beforeEach, describe, expect, it, vi } from "vitest";
const memory = vi.hoisted(() => ({ version: 5, rows: new Map<string, { requestHash: string; type: string; response: unknown }>() }));
vi.mock("@/lib/db/prisma", () => {
  const operations = {
    findUnique: async ({ where }: { where: { checkoutId_operationId: { operationId: string } } }) => memory.rows.get(where.checkoutId_operationId.operationId) ?? null,
    findUniqueOrThrow: async ({ where }: { where: { checkoutId_operationId: { operationId: string } } }) => {
      const row = memory.rows.get(where.checkoutId_operationId.operationId); if (!row) throw new Error("missing receipt"); return row;
    },
    create: async ({ data }: { data: { operationId: string; requestHash: string; type: string } }) => memory.rows.set(data.operationId, { ...data, response: null }),
    updateMany: async ({ where, data }: { where: { operationId: string }; data: { response: unknown } }) => {
      const row = memory.rows.get(where.operationId)!; if (row.response === null) row.response = data.response;
    },
  };
  const tx = { $queryRaw: async () => [], marketplaceCheckout: { findUniqueOrThrow: async () => ({ version: memory.version }) }, marketplaceCheckoutOperation: operations };
  return { prisma: { ...tx, $transaction: async (work: (db: typeof tx) => Promise<unknown>) => work(tx) } };
});
import { runCheckoutCommand } from "@/lib/marketplace-checkout/checkout-command-receipt";
const command = { checkoutId: "checkout", operationId: "operation", requestHash: "caller-hash", expectedVersion: 5, type: "PREPARE_PAYMENT" as const };

describe("checkout command policy with a mocked transaction repository (T1)", () => {
  beforeEach(() => { memory.version = 5; memory.rows.clear(); });
  it("replays a saved result despite subsequent version changes without repeating provider work", async () => {
    const work = vi.fn(async () => ({ paymentId: "payment-one", providerAction: { type: "REDIRECT_GET", endpoint: "https://checkout.paystack.com/synthetic" } }));
    const result = await runCheckoutCommand(command, work);
    memory.version = 6;
    expect(await runCheckoutCommand(command, work)).toEqual(result);
    expect(work).toHaveBeenCalledTimes(1);
  });
  it.each([{ requestHash: "changed" }, { expectedVersion: 6 }, { type: "RESERVE" as const }])("refuses operation identity reuse with altered meaning %j before side effects", async change => {
    await runCheckoutCommand(command, async () => ({ paymentId: "payment-one" }));
    const work = vi.fn(async () => ({ paymentId: "payment-two" }));
    await expect(runCheckoutCommand({ ...command, ...change }, work)).rejects.toMatchObject({ code: "CHECKOUT_OPERATION_CONFLICT" });
    expect(work).not.toHaveBeenCalled();
    expect(memory.rows.size).toBe(1);
  });
  it("refuses a new stale operation and does not claim or invoke it", async () => {
    memory.version = 6; const work = vi.fn(async () => ({ paymentId: "never" }));
    await expect(runCheckoutCommand(command, work)).rejects.toMatchObject({ code: "CHECKOUT_VERSION_CONFLICT" });
    expect(memory.rows.size).toBe(0); expect(work).not.toHaveBeenCalled();
  });
  it("recovers an incomplete command after a failure using the same bound identity", async () => {
    const work = vi.fn().mockRejectedValueOnce(new Error("provider pending")).mockResolvedValueOnce({ paymentId: "same-source" });
    await expect(runCheckoutCommand(command, work)).rejects.toThrow("provider pending");
    expect(memory.rows.get(command.operationId)?.response).toBeNull();
    await expect(runCheckoutCommand({ ...command, requestHash: "tampered" }, work)).rejects.toMatchObject({ code: "CHECKOUT_OPERATION_CONFLICT" });
    expect(await runCheckoutCommand(command, work)).toEqual({ paymentId: "same-source" });
    expect(work).toHaveBeenCalledTimes(2);
  });
});
