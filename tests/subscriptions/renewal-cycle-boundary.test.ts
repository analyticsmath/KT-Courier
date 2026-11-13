import { expect, it, vi } from "vitest";
import { createPrismaSubscriptionRenewalLifecycleRepository } from "@/lib/subscriptions/subscription-renewal-lifecycle.service";

it("does not create another invoice when the latest cycle has not started", async () => {
  const create = vi.fn(async () => ({ id: "next", publicReference: "next" }));
  const tx = { $queryRaw: vi.fn(), subscriptionContract: { findUnique: vi.fn(async () => ({ id: "contract", status: "ACTIVE", billingCycles: [{ cycleNumber: 2, periodStart: new Date("2030-02-01"), periodEnd: new Date("2030-03-01"), invoice: {} }] })) }, subscriptionBillingCycle: { findUnique: vi.fn(), create }, subscriptionInvoice: { create: vi.fn(async () => ({ publicReference: "invoice" })) } };
  const database = { $transaction: async (fn: (client: unknown) => Promise<unknown>) => fn(tx) };
  const result = await createPrismaSubscriptionRenewalLifecycleRepository(database).createNextCycle({ contractReference: "contract", operationId: "op", at: new Date("2030-01-15") });
  expect(result.outcome).toBe("NOT_DUE");
  expect(create).not.toHaveBeenCalled();
});
