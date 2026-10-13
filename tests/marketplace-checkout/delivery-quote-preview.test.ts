import { expect, it } from "vitest";
import { storeDeliveryQuotePreviews } from "@/lib/marketplace-checkout/delivery-quote-preview";
const quote = { storeReference: "store", fee: "89.00", currency: "ZAR", publicReference: "quote", serviceLevel: "Economy · 3–4 business days" };
it("shows the quoted fee even before delivery-option persistence", () => { expect(storeDeliveryQuotePreviews(["store"], [quote])).toEqual([{ storeReference: "store", fee: "89.00", serviceLevel: quote.serviceLevel }]); });
it.each([{ storeReference: "foreign" }, { fee: "-1.00" }, { fee: "1.234" }, { fee: "Infinity" }, { currency: "USD" }, { publicReference: "" }])("refuses foreign or malformed preview evidence %j", change => { expect(() => storeDeliveryQuotePreviews(["store"], [{ ...quote, ...change }])).toThrow(); });
it("refuses duplicate or omitted store quotes", () => { expect(() => storeDeliveryQuotePreviews(["store", "other"], [quote, quote])).toThrow(); expect(() => storeDeliveryQuotePreviews(["store"], [])).toThrow(); });
