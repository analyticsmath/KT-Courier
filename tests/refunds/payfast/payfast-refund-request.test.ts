import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { buildPayfastRefundRequest } from "@/lib/refunds/providers/payfast/payfast-refund-request";
import type { PayfastRefundRuntimeConfiguration } from "@/lib/refunds/providers/payfast/payfast-refund-config";

const config: PayfastRefundRuntimeConfiguration = { merchantId: "10000100", passphrase: "secret", credentialVersion: "v1", apiOrigin: "https://api.payfast.co.za", apiVersion: "v1" };
const input = { refundPublicReference: "R-1", paymentPublicReference: "P-1", providerPaymentId: "PF-PAYMENT-1", amount: "12.34", currency: "ZAR", reasonCode: "SERVICE_FAILURE", providerOperationKey: "operation-1" } as const;
describe("Payfast refund request", () => {
  it("builds a pinned POST with bounded official fields and a deterministic injected amount unit", () => {
    const request = buildPayfastRefundRequest(input, config, { timestamp: "2026-07-18T10:11:12.000Z", amountSerializer: (amount: Prisma.Decimal) => amount.toFixed(2) });
    expect(request.url).toBe("https://api.payfast.co.za/refunds/PF-PAYMENT-1");
    expect(request.method).toBe("POST");
    expect(JSON.parse(request.body)).toEqual({ amount: "12.34", reason: "KT_COURIERS_SERVICE_FAILURE", notify_buyer: "0" });
    expect(request.headers).toEqual(expect.objectContaining({ "merchant-id": "10000100", version: "v1", timestamp: "2026-07-18T10:11:12.000Z", "content-type": "application/json" }));
  });
  it("supports full and partial values through the same explicit serializer contract", () => {
    const serializer = (amount: Prisma.Decimal) => amount.toFixed(2);
    expect(JSON.parse(buildPayfastRefundRequest({ ...input, amount: "100.00" }, config, { timestamp: "2026-07-18T10:11:12.000Z", amountSerializer: serializer }).body).amount).toBe("100.00");
  });
  it("does not include bank, card, credentials, signatures, or raw identity in the safe snapshot", () => {
    const request = buildPayfastRefundRequest(input, config, { timestamp: "2026-07-18T10:11:12.000Z", amountSerializer: (amount) => amount.toFixed(2) });
    expect(JSON.stringify(request.safeRequestSnapshot)).not.toMatch(/bank|account|branch|card|passphrase|signature|merchant/i);
  });
});
