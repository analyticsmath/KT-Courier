import { describe, expect, it } from "vitest";
import {
  processSubscriptionRenewal,
  type SubscriptionRenewalRepository,
} from "@/lib/subscriptions/subscription-renewal.service";
import type { RecurringPaymentProvider } from "@/lib/subscriptions/providers/recurring-payment-provider";

describe("Subscription Renewal Lifecycle Integration Tests", () => {
  it("enforces fail-closed production lock without test approval", async () => {
    const fakeRepo: SubscriptionRenewalRepository = {
      lockRenewalJob: async () => null,
      markPaymentPending: async () => {},
      markUnknownOutcomeForReconciliation: async () => {},
      markDefinitiveFailure: async () => {},
    };

    const fakeProvider = {
      chargeBillingCycle: async () => ({
        status: "PENDING",
        safeEvidence: {},
      }),
    } as unknown as RecurringPaymentProvider;

    await expect(
      processSubscriptionRenewal(fakeRepo, fakeProvider, {
        operationId: "op-ren-1",
      })
    ).rejects.toThrowError(/validation is approved|production/i);
  });

  it("handles replay when renewal job is already completed", async () => {
    const fakeRepo: SubscriptionRenewalRepository = {
      lockRenewalJob: async () => ({
        status: "COMPLETED",
        authorityReference: "AUTH-1",
        invoiceReference: "INV-1",
        paymentReference: "PAY-1",
        amount: "100.00",
        currency: "ZAR",
      }),
      markPaymentPending: async () => {},
      markUnknownOutcomeForReconciliation: async () => {},
      markDefinitiveFailure: async () => {},
    };

    const fakeProvider = {
      chargeBillingCycle: async () => {
        throw new Error("Provider should not be called for completed job");
      },
    } as unknown as RecurringPaymentProvider;

    const result = await processSubscriptionRenewal(fakeRepo, fakeProvider, {
      operationId: "op-ren-2",
      testApproval: { approved: true },
    });

    expect(result.outcome).toBe("REPLAY");
  });

  it("routes unknown provider outcome to RECONCILIATION_REQUIRED", async () => {
    let unknownMarked = false;

    const fakeRepo: SubscriptionRenewalRepository = {
      lockRenewalJob: async () => ({
        status: "PENDING",
        authorityReference: "AUTH-1",
        invoiceReference: "INV-1",
        paymentReference: "PAY-1",
        amount: "100.00",
        currency: "ZAR",
      }),
      markPaymentPending: async () => {},
      markUnknownOutcomeForReconciliation: async () => {
        unknownMarked = true;
      },
      markDefinitiveFailure: async () => {},
    };

    const fakeProvider = {
      chargeBillingCycle: async () => ({
        status: "UNKNOWN" as const,
        safeEvidence: { reason: "TIMEOUT" },
      }),
    } as unknown as RecurringPaymentProvider;

    const result = await processSubscriptionRenewal(fakeRepo, fakeProvider, {
      operationId: "op-ren-3",
      testApproval: { approved: true },
    });

    expect(result.outcome).toBe("RECONCILIATION_REQUIRED");
    expect(unknownMarked).toBe(true);
  });
});
