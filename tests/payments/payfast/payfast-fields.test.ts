import { describe, expect, it } from "vitest";
import { normalizePayfastUnsignedFields, PAYFAST_V1_FIELD_ORDER } from "@/lib/payments/providers/payfast/payfast-fields";

const fields = {
  merchant_id: " 10000100 ", merchant_key: " key ", return_url: "https://app.example.test/return", cancel_url: "https://app.example.test/cancel", notify_url: "https://app.example.test/itn",
  name_first: " Jöhn ", name_last: "", email_address: "payer@example.test", m_payment_id: "kt:payment:pay_reference_123:attempt:1", amount: "123.45", item_name: "KT Courier Order KT-1", item_description: "Courier service payment",
};

describe("Payfast canonical fields", () => {
  it("normalizes once in explicit provider order and omits empty optionals", () => {
    const result = normalizePayfastUnsignedFields(fields);
    expect(Object.keys(result)).toEqual(PAYFAST_V1_FIELD_ORDER.filter((key) => key !== "name_last"));
    expect(result.name_first).toBe("Jöhn");
    expect(Object.isFrozen(result)).toBe(true);
  });
  it.each([{ ...fields, amount: "1" }, { ...fields, amount: "0.00" }, { ...fields, m_payment_id: "has spaces" }, { ...fields, email_address: "invalid" }])("rejects invalid business fields", (input) => expect(() => normalizePayfastUnsignedFields(input)).toThrow());
  it("rejects unsupported fields rather than signing a subset", () => expect(() => normalizePayfastUnsignedFields({ ...fields, custom_str1: "no" } as typeof fields)).toThrow());
});
