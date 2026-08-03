import { describe, expect, it } from "vitest";
import { generatePayfastRecurringApiSignature, buildPayfastRecurringApiRequest, toPayfastZarCents } from "@/lib/subscriptions/providers/payfast-recurring-api";
import { PayfastRecurringPaymentAdapter } from "@/lib/subscriptions/providers/payfast-recurring-adapter";
import { SubscriptionError } from "@/lib/subscriptions/errors";

const configuration = { merchantId: "10000100", passphrase: "secret", apiOrigin: "https://api.payfast.co.za" as const, apiVersion: "v1" as const };
const runtime = { mode: "sandbox" as const, environment: "sandbox" as const, merchantId: "10000100", merchantKey: "key", passphrase: "secret", appOrigin: "https://example.test", processingEndpoint: "https://sandbox.payfast.co.za/eng/process" as const, signatureVersion: "payfast-md5-v1" as const, requestFieldVersion: "payfast-custom-checkout-v1" as const, configurationFingerprint: "payfast-v1:sandbox" as const, credentialVersion: "credential-v1" };

describe("PayFast recurring REST protocol", () => {
  it("uses the Phase 15 REST signature construction with alphabetical ordering, bound timestamp, PHP encoding, and sandbox exclusion", () => {
    expect(generatePayfastRecurringApiSignature({ merchantId: "10000100", passphrase: "secret", timestamp: "2026-07-19T00:00:00.000Z", body: { reason: "A+B & C", sandbox: "1" } })).toBe("7e016241a7212c9b8f4055d904b6621e");
  });

  it("pins the HTTPS recurring host, serializes exact cents, and does not use a custom checkout request", () => {
    expect(toPayfastZarCents("123.45")).toBe("12345");
    expect(() => toPayfastZarCents("1.999")).toThrow(SubscriptionError);
    const request = buildPayfastRecurringApiRequest({ configuration, timestamp: "2026-07-19T00:00:00.000Z", method: "POST", path: "/subscriptions/authorizations", operationId: "op-1", body: { amount: "12345" } });
    expect(request.url).toBe("https://api.payfast.co.za/subscriptions/authorizations");
    expect(request.headers).toMatchObject({ "merchant-id": "10000100", version: "v1", timestamp: "2026-07-19T00:00:00.000Z", "idempotency-key": "op-1" });
    expect(JSON.stringify(request)).not.toContain("eng/process");
  });

  it("requires recurring-specific invoice binding, normalizes fetch/cancel safely, and treats network failure as unknown", async () => {
    const adapter = new PayfastRecurringPaymentAdapter(runtime, { now: () => new Date("2026-07-19T00:00:00.000Z"), transport: async (request) => {
      if (request.method === "POST") return { status: 201, redirected: false, body: { merchant_reference: "subinv_A1", redirect_url: "https://secure.payfast.co.za/authorize/abc", status: "PENDING" } };
      if (request.method === "DELETE") return { status: 204, redirected: false, body: { status: "CANCELLED" } };
      return { status: 200, redirected: false, body: { id: "authority_A1", status: "ACTIVE" } };
    } });
    const authorization = await adapter.createRecurringAuthorization({ invoiceReference: "subinv_A1", contractReference: "subcon_A1", amount: "12.50", currency: "ZAR", billingDate: "2026-07-19T00:00:00.000Z", returnUrl: "https://example.test/return", cancelUrl: "https://example.test/cancel", notificationUrl: "https://example.test/itn", operationId: "op-A1" });
    expect(authorization.action.type).toBe("REDIRECT_GET");
    expect(authorization.safeEvidence).toMatchObject({ mode: "PROVIDER_MANAGED_SUBSCRIPTION", merchantReference: "subinv_A1", amountInCents: "1250" });
    expect(await adapter.fetchRecurringAuthority({ authorityReference: "local_A1", contractReference: "subcon_A1", providerSubscriptionReference: "authority_A1", tokenFingerprint: null })).toMatchObject({ status: "ACTIVE" });
    expect(await adapter.cancelRecurringAuthority({ authorityReference: "local_A1", contractReference: "subcon_A1", providerSubscriptionReference: "authority_A1", tokenFingerprint: null, operationId: "cancel-A1" })).toMatchObject({ status: "CANCELLED" });
    await expect(adapter.chargeTokenizedCycle({ authorityReference: "local_A1", contractReference: "subcon_A1", providerSubscriptionReference: "authority_A1", tokenFingerprint: null, invoiceReference: "subinv_A1", paymentReference: "pay_A1", amount: "12.50", currency: "ZAR", operationId: "charge-A1" })).rejects.toMatchObject({ code: "CONSOLIDATED_VALIDATION_NOT_APPROVED" });
  });
});
