import { describe, expect, it } from "vitest";
import { buildPayfastCallbackUrls } from "@/lib/payments/providers/payfast/payfast-callback-urls";

describe("Payfast callback URLs", () => {
  it("builds return, cancel, and reserved notify routes from one trusted HTTPS origin", () => expect(buildPayfastCallbackUrls("https://app.example.test", "pay_abcdefghijklmnop")).toEqual({
    returnUrl: "https://app.example.test/payments/payfast/return?payment=pay_abcdefghijklmnop",
    cancelUrl: "https://app.example.test/payments/payfast/cancel?payment=pay_abcdefghijklmnop",
    notificationUrl: "https://app.example.test/api/payments/payfast/itn",
    returnRouteId: "payfast-return", cancelRouteId: "payfast-cancel", notificationRouteId: "payfast-itn-reserved",
  }));
  it.each(["http://app.example.test", "https://user:pass@app.example.test", "https://app.example.test/path"])("rejects unsafe origin %s", (origin) => expect(() => buildPayfastCallbackUrls(origin, "pay_abcdefghijklmnop")).toThrow());
  it("rejects malformed public payment references", () => expect(() => buildPayfastCallbackUrls("https://app.example.test", "internal-id")).toThrow());
});
