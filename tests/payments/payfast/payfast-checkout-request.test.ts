import { describe, expect, it } from "vitest";
import { buildPayfastCheckoutRequest } from "@/lib/payments/providers/payfast/payfast-checkout-request";
import { checkoutInput, sandboxConfig } from "./payfast-test-fixtures";

describe("Payfast checkout request", () => {
  it("derives exact server input fields and excludes unsupported/private business data", () => {
    expect(buildPayfastCheckoutRequest(checkoutInput, sandboxConfig)).toMatchObject({
      merchant_id: "merchant-id",
      merchant_key: "merchant-key",
      email_address: "payer@example.test",
      name_first: "Thandi",
      name_last: "Ndlovu",
      m_payment_id: checkoutInput.merchantReference,
      amount: "123.45",
      item_name: "KT Courier Order KT-1001",
      item_description: "Courier service payment",
      signature: expect.stringMatching(/^[a-f0-9]{32}$/),
    });
  });
  it("excludes the passphrase and unsupported recurring/split fields", () => {
    expect(Object.keys(buildPayfastCheckoutRequest(checkoutInput, sandboxConfig))).not.toEqual(
      expect.arrayContaining(["passphrase", "subscription_type", "token", "split_payment"]),
    );
  });
  it.each([{ ...checkoutInput, amount: "123.456" }, { ...checkoutInput, currency: "USD" as "ZAR" }, { ...checkoutInput, returnUrl: "https://attacker.invalid/return" }])("rejects non-authoritative/unsafe input", (input) => expect(() => buildPayfastCheckoutRequest(input, sandboxConfig)).toThrow());
});
