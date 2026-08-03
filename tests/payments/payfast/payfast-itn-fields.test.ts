import { describe, expect, it } from "vitest";
import { parsePayfastItnForm } from "@/lib/payments/providers/payfast/payfast-itn-parser";
import { validatePayfastItnFields } from "@/lib/payments/providers/payfast/payfast-itn-fields";
import { fixedItnBody } from "./payfast-itn-test-fixtures";

describe("Payfast ITN required fields", () => {
  it("returns bounded required evidence and counts unknown fields without persisting their values", () => {
    const result = validatePayfastItnFields(parsePayfastItnForm(`${fixedItnBody}&future_field=private-value&email_address=payer%40example.test`));
    expect(result).toMatchObject({ providerPaymentId: "123456", providerStatus: "COMPLETE", amountGross: "123.45", unknownFieldCount: 1 });
    expect(JSON.stringify(result.safePayloadSnapshot)).not.toContain("private-value");
    expect(JSON.stringify(result.safePayloadSnapshot)).not.toContain("payer@example.test");
  });
  it.each(["signature", "merchant_id", "amount_gross", "payment_status", "pf_payment_id", "m_payment_id"])("rejects missing %s", (key) => {
    const body = fixedItnBody.split("&").filter((pair) => !pair.startsWith(`${key}=`)).join("&");
    expect(() => validatePayfastItnFields(parsePayfastItnForm(body))).toThrow();
  });
  it("accepts only bounded exact optional fee/net audit amounts", () => {
    expect(validatePayfastItnFields(parsePayfastItnForm(`${fixedItnBody}&amount_fee=-2.50&amount_net=120.95`))).toMatchObject({ amountFee: "-2.50", amountNet: "120.95" });
    expect(() => validatePayfastItnFields(parsePayfastItnForm(`${fixedItnBody}&amount_fee=1e2`))).toThrow();
    expect(() => validatePayfastItnFields(parsePayfastItnForm(`${fixedItnBody}&amount_net=120.951`))).toThrow();
  });
  it("retains a bounded unfamiliar status token for conservative normalization", () => {
    expect(validatePayfastItnFields(parsePayfastItnForm(fixedItnBody.replace("payment_status=COMPLETE", "payment_status=Review_Required")))).toMatchObject({ providerStatus: "Review_Required" });
  });
});
