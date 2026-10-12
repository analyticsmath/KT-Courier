import { describe, expect, it, vi } from "vitest";
import { PaystackRefundAdapter } from "../../lib/refunds/providers/paystack/paystack-refund-adapter";
import { PaystackClient } from "../../lib/payments/providers/paystack/paystack-client";
import { validateRefundProviderResult } from "../../lib/refunds/providers/refund-provider-result";
import { createMerchantReference } from "../../lib/payments/merchant-reference";

const context = () => ({ signal: new AbortController().signal, correlationId: "disposable-refund-binding", timeoutMs: 1000 });
const input = { refundPublicReference: "RF-SYNTHETIC", paymentPublicReference: "PAY-SYNTHETIC", providerPaymentId: "canonical-payment", amount: "0.03", currency: "ZAR" as const, reasonCode: "SERVICE_NOT_PROVIDED", providerOperationKey: "synthetic-create" };
const facts = { id: 42, amount: 3, transaction: { id: 77, reference: "canonical-payment" }, currency: "ZAR", deducted_amount: 0, status: "processed" };
function adapter(data: typeof facts) {
  const client = new PaystackClient({ secretKey: "sk_test_disposable_contract" });
  const create = vi.spyOn(client, "createRefund").mockResolvedValue(data);
  vi.spyOn(client, "getRefund").mockResolvedValue(data);
  return { authority: new PaystackRefundAdapter(client), create };
}
describe("Paystack refund returned financial fact binding", () => {
  it("preserves a queryable refund ID for an unknown result on an escaped canonical payment reference", async () => {
    const reference = createMerchantReference("pay_SYNTHETIC_1234", 1);
    const f = adapter({ ...facts, transaction: { id: 77, reference }, status: "unrecognized" });
    const result = validateRefundProviderResult(await f.authority.createRefund({ ...input, providerPaymentId: reference }, context()));
    expect(result).toMatchObject({ status: "UNKNOWN", definitive: false, providerRefundId: "42", providerPaymentId: reference });
    expect(validateRefundProviderResult(await f.authority.queryRefund({ refundPublicReference: input.refundPublicReference, providerRefundId: "42", providerPaymentId: reference }, context()))).toMatchObject({ providerRefundId: "42", providerPaymentId: reference, amount: "0.03", status: "UNKNOWN" });
  });
  for (const reference of ["payment with spaces", "payment\nreference", "https://foreign.example.test/payment"]) it(`denies unsafe payment reference ${JSON.stringify(reference)}`, () => {
    expect(() => validateRefundProviderResult({ status: "UNKNOWN", definitive: false, providerPaymentId: reference })).toThrow();
  });
  it("posts exact subunits and returns independent definitive evidence", async () => {
    const f = adapter(facts); const result = await f.authority.createRefund(input, context());
    expect(f.create).toHaveBeenCalledWith(expect.objectContaining({ amountCents: 3, transaction: "canonical-payment", currency: "ZAR" }), expect.any(AbortSignal));
    expect(result).toMatchObject({ status: "SUCCEEDED", definitive: true, providerPaymentId: "canonical-payment", providerRefundId: "42", amount: "0.03", currency: "ZAR" });
  });
  for (const changed of [{ amount: 4 }, { amount: 3.1 }, { currency: "USD" }, { transaction: { id: 99, reference: "foreign-payment" } }]) it(`rejects changed source facts ${JSON.stringify(changed)}`, async () => {
    await expect(adapter({ ...facts, ...changed }).authority.createRefund(input, context())).rejects.toMatchObject({ code: "REFUND_PROVIDER_RESPONSE_INVALID" });
  });
  for (const status of ["pending", "processing", "unknown-future-status"]) it(`retains nondefinitive ${status}`, async () => {
    expect(await adapter({ ...facts, status }).authority.createRefund(input, context())).toMatchObject({ definitive: false, status: status === "unknown-future-status" ? "UNKNOWN" : "PROCESSING" });
  });
  it("binds status query by numeric transaction ID without confusing its reference", async () => {
    expect(await adapter(facts).authority.queryRefund({ refundPublicReference: "RF-SYNTHETIC", providerRefundId: "42", providerPaymentId: "77" }, context())).toMatchObject({ status: "SUCCEEDED", providerPaymentId: "77", amount: "0.03" });
  });
  it("rejects foreign queried transaction and refund ID", async () => {
    const f = adapter(facts);
    await expect(f.authority.queryRefund({ refundPublicReference: "RF-SYNTHETIC", providerRefundId: "42", providerPaymentId: "foreign-payment" }, context())).rejects.toMatchObject({ code: "REFUND_PROVIDER_RESPONSE_INVALID" });
    await expect(f.authority.queryRefund({ refundPublicReference: "RF-SYNTHETIC", providerRefundId: "43" }, context())).rejects.toMatchObject({ code: "REFUND_PROVIDER_RESPONSE_INVALID" });
  });
});
