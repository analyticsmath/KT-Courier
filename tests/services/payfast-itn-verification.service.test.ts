import { describe, expect, it, vi } from "vitest";
import { PaymentError } from "@/lib/payments/errors";
import { calculatePayfastItnSignature } from "@/lib/payments/providers/payfast/payfast-itn-signature";
import { parsePayfastItnForm } from "@/lib/payments/providers/payfast/payfast-itn-parser";
import { verifyPayfastItn } from "@/lib/services/payfast-itn-verification.service";
import { fixedAttempt, fixedItnBody, fixedItnConfig } from "../payments/payfast/payfast-itn-test-fixtures";

const bytes = new TextEncoder().encode(fixedItnBody);
const base = { bodyBytes: bytes, bodyText: fixedItnBody, headers: new Headers({ "x-kt-source-ip": "196.1.2.3" }) };
const dependencies = () => ({ configuration: () => ({ runtime: fixedItnConfig, state: {} as never }), proxyMode: "single_trusted_proxy" as const, sourceResolver: { verify: vi.fn().mockResolvedValue(undefined) }, resolveAttempt: vi.fn().mockResolvedValue(fixedAttempt), confirm: vi.fn().mockResolvedValue(undefined), findReceipt: vi.fn().mockResolvedValue(null), clock: () => new Date("2026-07-17T12:00:00.000Z") });
const resign = (body: string) => body.replace(/signature=[A-Fa-f0-9]{32}/, `signature=${calculatePayfastItnSignature(parsePayfastItnForm(body).orderedFields, fixedItnConfig.passphrase).toString("hex")}`);

describe("Payfast ITN verification service", () => {
  it("passes every gate without opening a transaction around provider confirmation", async () => {
    const deps = dependencies();
    const result = await verifyPayfastItn(base, deps);
    expect(result).toMatchObject({ kind: "VERIFIED", receipt: { sourceAddressVerified: true, signatureVerified: true, merchantVerified: true, amountVerified: true, providerDataVerified: true }, attempt: { id: "attempt-id" } });
    expect(deps.confirm).toHaveBeenCalledTimes(1);
    expect(deps.confirm).toHaveBeenCalledWith({
      environment: "SANDBOX",
      canonicalBody: "m_payment_id=kt%3Apayment%3Apay_abcdefghijklmnop%3Aattempt%3A1&pf_payment_id=123456&payment_status=COMPLETE&amount_gross=123.45&merchant_id=10000100&custom_str1=hello+world",
    });
  });
  it("short-circuits a terminal exact duplicate after source verification and before provider confirmation", async () => {
    const deps = dependencies(); deps.findReceipt.mockResolvedValue({ id: "event", processingStatus: "APPLIED" });
    await expect(verifyPayfastItn(base, deps)).resolves.toMatchObject({ kind: "EXISTING", processingStatus: "APPLIED" });
    expect(deps.confirm).not.toHaveBeenCalled();
  });
  it("fails invalid source before resolution", async () => {
    const deps = dependencies(); deps.sourceResolver.verify.mockRejectedValue(new PaymentError("PAYFAST_SOURCE_NOT_ALLOWED", "invalid"));
    await expect(verifyPayfastItn(base, deps)).rejects.toMatchObject({ code: "PAYFAST_SOURCE_NOT_ALLOWED" });
    expect(deps.resolveAttempt).not.toHaveBeenCalled();
  });
  it("captures credential mismatch and confirmation unavailability as reconciliation-safe failures", async () => {
    const mismatch = dependencies(); mismatch.resolveAttempt.mockResolvedValue({ ...fixedAttempt, providerCredentialVersion: "old" });
    await expect(verifyPayfastItn(base, mismatch)).rejects.toMatchObject({ code: "PAYFAST_CREDENTIAL_VERSION_MISMATCH", reconciliationReason: "CREDENTIAL_VERSION_MISMATCH" });
    const unavailable = dependencies(); unavailable.confirm.mockRejectedValue(new PaymentError("PAYFAST_CONFIRMATION_UNAVAILABLE", "retry", true));
    await expect(verifyPayfastItn(base, unavailable)).rejects.toMatchObject({ code: "PAYFAST_CONFIRMATION_UNAVAILABLE", retryable: true, reconciliationReason: "PROVIDER_CONFIRMATION_UNAVAILABLE" });
  });
  it.each([
    [fixedItnBody.replace("signature=3", "signature=4"), "PAYFAST_ITN_SIGNATURE_INVALID"],
    [fixedItnBody.replace("merchant_id=10000100", "merchant_id=20000200"), "PAYFAST_ITN_SIGNATURE_INVALID"],
    [fixedItnBody.replace("amount_gross=123.45", "amount_gross=123.46"), "PAYFAST_ITN_SIGNATURE_INVALID"],
  ])("rejects changed signed data", async (body, code) => await expect(verifyPayfastItn({ ...base, bodyText: body, bodyBytes: new TextEncoder().encode(body) }, dependencies())).rejects.toMatchObject({ code }));
  it("distinguishes merchant and exact amount gates after a valid signature", async () => {
    const merchantBody = resign(fixedItnBody.replace("merchant_id=10000100", "merchant_id=20000200"));
    await expect(verifyPayfastItn({ ...base, bodyText: merchantBody, bodyBytes: new TextEncoder().encode(merchantBody) }, dependencies())).rejects.toMatchObject({ code: "PAYFAST_MERCHANT_MISMATCH", reconciliationReason: "MERCHANT_MISMATCH" });
    const amountBody = resign(fixedItnBody.replace("amount_gross=123.45", "amount_gross=123.46"));
    await expect(verifyPayfastItn({ ...base, bodyText: amountBody, bodyBytes: new TextEncoder().encode(amountBody) }, dependencies())).rejects.toMatchObject({ code: "PAYFAST_AMOUNT_MISMATCH", reconciliationReason: "AMOUNT_MISMATCH" });
  });
  it("keeps a confirmed unknown provider status as verified UNKNOWN evidence", async () => {
    const unknownBody = resign(fixedItnBody.replace("payment_status=COMPLETE", "payment_status=REVIEW"));
    await expect(verifyPayfastItn({ ...base, bodyText: unknownBody, bodyBytes: new TextEncoder().encode(unknownBody) }, dependencies())).resolves.toMatchObject({ kind: "VERIFIED", receipt: { normalizedStatus: "UNKNOWN", providerDataVerified: true } });
  });
  it("does not convert an invalid provider confirmation into verified evidence", async () => {
    const deps = dependencies(); deps.confirm.mockRejectedValue(new PaymentError("PAYFAST_CONFIRMATION_INVALID", "invalid"));
    await expect(verifyPayfastItn(base, deps)).rejects.toMatchObject({ code: "PAYFAST_CONFIRMATION_INVALID", receipt: { providerDataVerified: false } });
  });
});
