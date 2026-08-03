import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PayfastAdapter } from "@/lib/payments/providers/payfast/payfast-adapter";
import { PaymentProviderRegistry } from "@/lib/payments/providers/payment-provider-registry";
import { checkoutInput, sandboxConfig } from "../payments/payfast/payfast-test-fixtures";

const mocks = vi.hoisted(() => ({ findUnique: vi.fn() }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { paymentAttempt: { findUnique: mocks.findUnique } } }));
import { buildOwnedPayfastCheckoutAction } from "@/lib/services/payfast-checkout.service";

const row = {
  id: "attempt-id", publicReference: "pat_abcdefghijklmnopqrstu", provider: "PAYFAST", status: "REQUIRES_ACTION", checkoutActionType: "FORM_POST", providerEnvironment: "SANDBOX", attemptNumber: 1,
  providerProtocolVersion: "payfast-custom-checkout-v1", configurationFingerprint: "payfast-v1:sandbox", providerCredentialVersion: "sandbox-v1", merchantReference: checkoutInput.merchantReference, amount: new Prisma.Decimal("123.45"),
  payment: { id: "payment-id", publicReference: "pay_abcdefghijklmnop", userId: "payer-id", status: "REQUIRES_ACTION", latestAttemptNumber: 1, user: { id: "payer-id", email: "payer@example.test", name: "Thandi Ndlovu" }, order: { orderNumber: "KT-1001" } },
};
const callbacks = () => ({ returnUrl: checkoutInput.returnUrl, cancelUrl: checkoutInput.cancelUrl, notificationUrl: checkoutInput.notificationUrl, returnRouteId: "payfast-return" as const, cancelRouteId: "payfast-cancel" as const, notificationRouteId: "payfast-itn-reserved" as const });

beforeEach(() => { vi.clearAllMocks(); mocks.findUnique.mockResolvedValue(row); });
describe("Payfast checkout reconstruction service", () => {
  it("reconstructs an immutable signed action from owned authoritative records", async () => {
    const action = await buildOwnedPayfastCheckoutAction("payer-id", row.publicReference, { registry: new PaymentProviderRegistry({ adapters: [new PayfastAdapter(sandboxConfig)] }), callbackUrls: callbacks });
    expect(action).toMatchObject({ type: "FORM_POST", url: "https://sandbox.payfast.co.za/eng/process", fields: { amount: "123.45", m_payment_id: checkoutInput.merchantReference, email_address: "payer@example.test", signature: expect.stringMatching(/^[a-f0-9]{32}$/) } });
    expect(action.fields).not.toHaveProperty("passphrase");
  });
  it("hides wrong payer and rejects stale/non-actionable attempts", async () => {
    await expect(buildOwnedPayfastCheckoutAction("other", row.publicReference, { registry: new PaymentProviderRegistry({ adapters: [new PayfastAdapter(sandboxConfig)] }), callbackUrls: callbacks })).rejects.toMatchObject({ code: "PAYMENT_ATTEMPT_NOT_FOUND" });
    mocks.findUnique.mockResolvedValueOnce({ ...row, status: "PROCESSING" });
    await expect(buildOwnedPayfastCheckoutAction("payer-id", row.publicReference, { registry: new PaymentProviderRegistry({ adapters: [new PayfastAdapter(sandboxConfig)] }), callbackUrls: callbacks })).rejects.toMatchObject({ code: "PAYFAST_ATTEMPT_NOT_ACTIONABLE" });
  });
  it("rejects a configuration version mismatch instead of re-signing under changed credentials", async () => {
    mocks.findUnique.mockResolvedValueOnce({ ...row, configurationFingerprint: "payfast-v1:changed" });
    await expect(buildOwnedPayfastCheckoutAction("payer-id", row.publicReference, { registry: new PaymentProviderRegistry({ adapters: [new PayfastAdapter(sandboxConfig)] }), callbackUrls: callbacks })).rejects.toMatchObject({ code: "PAYFAST_CHECKOUT_NOT_AVAILABLE" });
    mocks.findUnique.mockResolvedValueOnce({ ...row, providerCredentialVersion: "retired-v0" });
    await expect(buildOwnedPayfastCheckoutAction("payer-id", row.publicReference, { registry: new PaymentProviderRegistry({ adapters: [new PayfastAdapter(sandboxConfig)] }), callbackUrls: callbacks })).rejects.toMatchObject({ code: "PAYFAST_CHECKOUT_NOT_AVAILABLE" });
  });
});
