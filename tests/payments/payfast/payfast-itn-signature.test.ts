import { describe, expect, it } from "vitest";
import { parsePayfastItnForm } from "@/lib/payments/providers/payfast/payfast-itn-parser";
import { buildPayfastItnSignatureBase, verifyPayfastItnSignature } from "@/lib/payments/providers/payfast/payfast-itn-signature";
import { fixedItnBody, fixedItnSignature } from "./payfast-itn-test-fixtures";

describe("Payfast ITN signature", () => {
  it("matches an independently calculated fixed vector using received order", () => {
    const parsed = parsePayfastItnForm(fixedItnBody);
    expect(verifyPayfastItnSignature(parsed.orderedFields, fixedItnSignature, "top secret")).toBe(true);
    expect(buildPayfastItnSignatureBase(parsed.orderedFields, "top secret")).toBe("m_payment_id=kt%3Apayment%3Apay_abcdefghijklmnop%3Aattempt%3A1&pf_payment_id=123456&payment_status=COMPLETE&amount_gross=123.45&merchant_id=10000100&custom_str1=hello+world&passphrase=top+secret");
  });
  it.each([
    fixedItnBody.replace("amount_gross=123.45", "amount_gross=123.46"),
    fixedItnBody.replace("payment_status=COMPLETE", "payment_status=FAILED"),
    fixedItnBody.replace("pf_payment_id=123456", "pf_payment_id=654321"),
    fixedItnBody.split("&").reverse().join("&"),
    fixedItnBody.replace("custom_str1=hello+world&", ""),
  ])("rejects changed payload/order", (body) => expect(verifyPayfastItnSignature(parsePayfastItnForm(body).orderedFields, fixedItnSignature, "top secret")).toBe(false));
  it("omits empty fields, includes unknown non-empty fields, excludes signature, and rejects invalid hex", () => {
    const parsed = parsePayfastItnForm("a=1&empty=&future=x&signature=00000000000000000000000000000000");
    expect(buildPayfastItnSignatureBase(parsed.orderedFields, "secret")).toBe("a=1&future=x&passphrase=secret");
    expect(verifyPayfastItnSignature(parsed.orderedFields, "not-hex", "secret")).toBe(false);
  });
});
