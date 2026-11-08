import { beforeEach, describe, expect, it, vi } from "vitest";
import { prepareMarketplaceCheckoutPayment } from "@/lib/marketplace-checkout/marketplace-payment-preparation.service";
import type {
  MarketplacePaymentPreparationRepository, MarketplacePaymentOrchestrator,
} from "@/lib/marketplace-checkout/marketplace-payment-preparation.service";

const { assertReady, policyReady } = vi.hoisted(() => ({ assertReady: vi.fn(), policyReady: vi.fn() }));
vi.mock("@/lib/marketplace-checkout/production-lock", () => ({
  assertMarketplaceCheckoutProductionReady: assertReady,
}));
vi.mock("@/lib/testing/safe-postgres-validator", () => ({
  isLocalFullFlowAllowed: () => false,
}));
vi.mock("@/lib/marketplace-checkout/marketplace-fulfilment-readiness", () => ({
  assertNewMarketplacePaymentPolicyReady: policyReady,
}));

const redirect = { type: "REDIRECT_GET" as const, endpoint: "https://checkout.paystack.com/valid" };
const command = { checkoutReference: "CHK-1", payerEmail: "test@example.test", operationId: "retry-payment-1" };
const base = {
  id: "checkout-1", publicReference: "CHK-1", customerUserId: "customer-1",
  guestAccessTokenHash: null, status: "PAYMENT_PENDING", grandTotal: "35.70",
  digitalRequired: "35.70", currency: "ZAR", acceptedFingerprint: "frozen",
  reservationActive: true,
};
function repository(payment: {
  id: string; publicReference: string; amount: string; currency: string;
  fingerprint?: string; status: string; latestAttemptNumber: number;
  providerAction?: typeof redirect | null;
}): MarketplacePaymentPreparationRepository {
  return { readCheckout: async () => ({ ...base, payment }) };
}
const payment = { id: "p-1", publicReference: "PAY-1", amount: "35.70", currency: "ZAR", fingerprint: "frozen" };

beforeEach(() => { vi.clearAllMocks(); });
describe("marketplace payment preparation crash recovery", () => {
  it("resumes provider initialization for one existing CREATED Payment with zero attempts", async () => {
    const startAnotherPayment = vi.fn(async () => { throw new Error("must not create another Payment"); });
    const resume = vi.fn(async () => redirect);
    const orchestrator: MarketplacePaymentOrchestrator = {
      prepareMarketplacePayment: startAnotherPayment,
      resumeMarketplaceProviderAction: resume,
    };
    const result = await prepareMarketplaceCheckoutPayment(
      repository({ ...payment, status: "CREATED", latestAttemptNumber: 0 }), orchestrator, command,
    );
    expect(result).toEqual({
      paymentId: "p-1", paymentReference: "PAY-1", amount: "35.70", currency: "ZAR",
      providerAction: redirect, replayed: true,
    });
    expect(resume).toHaveBeenCalledExactlyOnceWith({
      paymentId: "p-1", paymentReference: "PAY-1", payerEmail: command.payerEmail,
      operationId: "retry-payment-1:paystack", guestCheckoutEvidence: false,
    });
    expect(startAnotherPayment).not.toHaveBeenCalled();
    expect(assertReady).toHaveBeenCalledOnce();
    expect(policyReady).toHaveBeenCalledOnce();
  });

  it.each([
    { status: "PROVIDER_PENDING", latestAttemptNumber: 1 },
    { status: "PROCESSING", latestAttemptNumber: 1 },
    { status: "CREATED", latestAttemptNumber: 1 },
  ])("never starts another Paystack attempt for in-flight or unknown state %j", async state => {
    const startAnotherPayment = vi.fn();
    const resume = vi.fn();
    await expect(prepareMarketplaceCheckoutPayment(
      repository({ ...payment, ...state }),
      { prepareMarketplacePayment: startAnotherPayment, resumeMarketplaceProviderAction: resume },
      command,
    )).rejects.toMatchObject({ code: "PAYMENT_PREPARATION_BLOCKED" });
    expect(startAnotherPayment).not.toHaveBeenCalled();
    expect(resume).not.toHaveBeenCalled();
  });

  it("replays an already authorized Paystack redirect without a second provider request", async () => {
    const resume = vi.fn();
    const result = await prepareMarketplaceCheckoutPayment(
      repository({ ...payment, status: "REQUIRES_ACTION", latestAttemptNumber: 1, providerAction: redirect }),
      { prepareMarketplacePayment: vi.fn(), resumeMarketplaceProviderAction: resume },
      command,
    );
    expect(result).toMatchObject({ replayed: true, providerAction: redirect });
    expect(resume).not.toHaveBeenCalled();
  });

  it("rejects mismatch of frozen financial fingerprint before any provider work", async () => {
    const resume = vi.fn();
    await expect(prepareMarketplaceCheckoutPayment(
      repository({ ...payment, fingerprint: "another-checkout", status: "CREATED", latestAttemptNumber: 0 }),
      { prepareMarketplacePayment: vi.fn(), resumeMarketplaceProviderAction: resume },
      command,
    )).rejects.toMatchObject({ code: "CHECKOUT_OPERATION_CONFLICT" });
    expect(resume).not.toHaveBeenCalled();
  });

  it("never returns success with a null provider action when authorization is unavailable", async () => {
    await expect(prepareMarketplaceCheckoutPayment(
      repository({ ...payment, status: "CREATED", latestAttemptNumber: 0 }),
      { prepareMarketplacePayment: vi.fn(), resumeMarketplaceProviderAction: vi.fn(async () => null) },
      command,
    )).rejects.toMatchObject({ code: "PAYMENT_PREPARATION_BLOCKED" });
  });
});
