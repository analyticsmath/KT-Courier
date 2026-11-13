import { expect, it, vi } from "vitest";
const query = vi.hoisted(() => vi.fn());
vi.mock("@/lib/db/prisma", () => ({ prisma: { subscriptionBillingCycle: { findMany: query } } }));
import { runSubscriptionRenewalBatch } from "@/lib/subscriptions/subscription-renewal-batch";
it("fails closed before selecting or preparing any cycle without financial authorization", async () => {
  await expect(runSubscriptionRenewalBatch()).rejects.toMatchObject({ code: "CONSOLIDATED_VALIDATION_NOT_APPROVED" });
  expect(query).not.toHaveBeenCalled();
});
