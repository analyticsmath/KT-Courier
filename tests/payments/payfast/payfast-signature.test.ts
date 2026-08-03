import { describe, expect, it } from "vitest";
import { buildSignedPayfastForm, generatePayfastSignature } from "@/lib/payments/providers/payfast/payfast-signature";
import type { PayfastUnsignedFields } from "@/lib/payments/providers/payfast/payfast-fields";

const vector = {
  merchant_id: "10000100", merchant_key: "test_key_123",
  return_url: "https://app.example.test/payments/payfast/return?payment=pay_vector_reference",
  cancel_url: "https://app.example.test/payments/payfast/cancel?payment=pay_vector_reference",
  notify_url: "https://app.example.test/api/payments/payfast/itn",
  name_first: "Jöhn", name_last: "O'Neil", email_address: "payer@example.test",
  m_payment_id: "kt:payment:pay_vector_reference:attempt:1", amount: "123.45",
  item_name: "KT Courier Order KT-1001", item_description: "Courier service payment",
};

describe("Payfast signatures", () => {
  it("matches an independently established fixed PHP-urlencode/MD5 vector", () => {
    // Expected digest was established independently with .NET UTF-8 bytes and MD5.
    expect(generatePayfastSignature(vector, "s3cret pass+&")).toBe("8b36dff459ec9656d0d625fc4610caee");
  });
  it("returns the exact immutable signed map without a passphrase field", () => {
    const result = buildSignedPayfastForm(vector, "s3cret pass+&");
    expect(result.signature).toBe("8b36dff459ec9656d0d625fc4610caee");
    expect(result).not.toHaveProperty("passphrase");
    expect(Object.isFrozen(result)).toBe(true);
    expect(() => { (result as Record<string, string>).amount = "1.00"; }).toThrow();
  });
  it("uses declared provider order rather than input insertion order", () => {
    const reversed = Object.fromEntries(Object.entries(vector).reverse()) as PayfastUnsignedFields;
    expect(generatePayfastSignature(reversed, "s3cret pass+&")).toBe("8b36dff459ec9656d0d625fc4610caee");
  });
  it("omits empty optional fields exactly like absent optional fields", () => {
    const absent = Object.fromEntries(
      Object.entries(vector).filter(([key]) => key !== "name_last" && key !== "item_description"),
    ) as PayfastUnsignedFields;
    expect(generatePayfastSignature({ ...vector, name_last: "", item_description: "" }, "s3cret pass+&")).toBe(
      generatePayfastSignature(absent, "s3cret pass+&"),
    );
  });
  it("rejects a caller-supplied signature instead of signing an unsupported field map", () => {
    expect(() => generatePayfastSignature(
      { ...vector, signature: "caller-controlled" } as unknown as PayfastUnsignedFields,
      "s3cret pass+&",
    )).toThrow();
  });
  it.each([
    ["merchant_id", "10000101"],
    ["merchant_key", "test_key_124"],
    ["amount", "123.46"],
    ["m_payment_id", "kt:payment:pay_vector_reference:attempt:2"],
    ["return_url", "https://app.example.test/payments/payfast/return?payment=pay_other_reference"],
  ] as const)("changes when signed field %s changes", (key, value) => {
    expect(generatePayfastSignature({ ...vector, [key]: value }, "s3cret pass+&")).not.toBe(
      "8b36dff459ec9656d0d625fc4610caee",
    );
  });
  it("changes with the passphrase and keeps invalid passphrase values out of errors", () => {
    expect(generatePayfastSignature(vector, "different-passphrase")).not.toBe(
      "8b36dff459ec9656d0d625fc4610caee",
    );
    expect(() => generatePayfastSignature(vector, "private\nvalue")).toThrowError(
      expect.not.objectContaining({ message: expect.stringContaining("private") }),
    );
  });
  it("requires the KT policy passphrase", () => expect(() => generatePayfastSignature(vector, "")).toThrow());
});
