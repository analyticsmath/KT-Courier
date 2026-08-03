import { describe, expect, it } from "vitest";
import { buildPayfastItnParameterString } from "@/lib/payments/providers/payfast/payfast-itn-parameter-string";
import { parsePayfastItnForm } from "@/lib/payments/providers/payfast/payfast-itn-parser";
import { fixedItnBody } from "./payfast-itn-test-fixtures";

const confirmationBody = "m_payment_id=kt%3Apayment%3Apay_abcdefghijklmnop%3Aattempt%3A1&pf_payment_id=123456&payment_status=COMPLETE&amount_gross=123.45&merchant_id=10000100&custom_str1=hello+world";

describe("Payfast canonical ITN parameter string", () => {
  it("normalizes the raw form into the hardcoded confirmation body without signature or passphrase", () => {
    const parsed = parsePayfastItnForm(fixedItnBody);
    const canonical = buildPayfastItnParameterString(parsed.orderedFields, { includePassphrase: false });

    expect(fixedItnBody).toContain("signature=");
    expect(canonical).toBe(confirmationBody);
    expect(canonical).not.toContain("signature=");
    expect(canonical).not.toContain("passphrase=");
    expect(canonical.endsWith("&")).toBe(false);
  });

  it("uses the same ordered field range for signature input and confirmation body", () => {
    const parsed = parsePayfastItnForm(fixedItnBody);
    const signatureInput = buildPayfastItnParameterString(parsed.orderedFields, { includePassphrase: true, passphrase: "top secret" });

    expect(signatureInput).toBe(`${confirmationBody}&passphrase=top+secret`);
    expect(signatureInput.slice(0, -"&passphrase=top+secret".length)).toBe(confirmationBody);
  });

  it("omits empty values and retains unknown non-empty fields in received order", () => {
    const parsed = parsePayfastItnForm("first=1&empty=&future=two+words&signature=00000000000000000000000000000000");
    expect(buildPayfastItnParameterString(parsed.orderedFields, { includePassphrase: false })).toBe("first=1&future=two+words");
  });

  it("uses the PHP-compatible encoder deterministically for special characters and Unicode", () => {
    const parsed = parsePayfastItnForm("special=%21%2A%27%28%29%2F&unicode=%E2%82%AC+%C3%A9&signature=00000000000000000000000000000000");
    expect(buildPayfastItnParameterString(parsed.orderedFields, { includePassphrase: false })).toBe("special=%21%2A%27%28%29%2F&unicode=%E2%82%AC+%C3%A9");
  });

  it("normalizes equivalent raw space encodings through the ordered field model", () => {
    const plus = parsePayfastItnForm("message=hello+world&signature=00000000000000000000000000000000");
    const percent = parsePayfastItnForm("message=hello%20world&signature=00000000000000000000000000000000");
    expect(buildPayfastItnParameterString(plus.orderedFields, { includePassphrase: false })).toBe("message=hello+world");
    expect(buildPayfastItnParameterString(percent.orderedFields, { includePassphrase: false })).toBe("message=hello+world");
  });

  it("fails closed when a non-empty field follows signature", () => {
    const parsed = parsePayfastItnForm("first=1&signature=00000000000000000000000000000000&late=2");
    expect(() => buildPayfastItnParameterString(parsed.orderedFields, { includePassphrase: false })).toThrow();
  });
});
