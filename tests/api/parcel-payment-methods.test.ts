import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

const mocks = vi.hoisted(() => ({
  user: vi.fn(), quote: vi.fn(), breakdown: vi.fn(), storeAccess: vi.fn(),
}));
vi.mock("@/lib/auth/current-user", () => ({ getCurrentUser: mocks.user }));
vi.mock("@/lib/client-platform/delivery.service", () => ({ readPublicQuote: mocks.quote }));
vi.mock("@/lib/client-platform/store-access", () => ({ storeAccess: mocks.storeAccess }));
vi.mock("@/lib/payments/payment-policy.service", async importOriginal => {
  const real = await importOriginal<typeof import("@/lib/payments/payment-policy.service")>();
  return { ...real, resolvePaymentBreakdown: mocks.breakdown };
});
import { GET } from "@/app/api/public/delivery-quotes/[id]/payment-methods/route";
import { PaymentPolicyError } from "@/lib/payments/payment-policy.service";
const context = { params: Promise.resolve({ id: "quote-a" }) };
const request = { headers: new Headers() } as never;
const quote = {
  id: "quote-a", total: new Prisma.Decimal("205.85"), deliveryType: "PARCEL_DOCUMENT",
  ruleSnapshot: { configurationId: "CLIENT_STANDARD", serviceKey: "CLIENT_STANDARD" },
  metadata: { bookingInput: { pickupAddress: { province: "Gauteng" }, dropoffAddress: { province: "Gauteng" } } },
  destinationRegionId: null,
};
const read = async () => {
  const response = await GET(request, context);
  return { status: response.status, body: await response.json() };
};
beforeEach(() => {
  vi.resetAllMocks();
  mocks.user.mockResolvedValue({ id: "customer", role: "CUSTOMER", status: "ACTIVE" });
  mocks.quote.mockResolvedValue(quote);
});
describe("parcel booking payment choices", () => {
  it("returns both payment choices with exact R0 upfront when full COD is authorized", async () => {
    mocks.breakdown.mockResolvedValue({ mode: "FULL_COD", digitalRequired: "0.00", cashRequired: "205.85" });
    const result = await read();
    expect(result.status).toBe(200);
    expect(result.body.methods).toEqual([
      { mode: "DIGITAL_ONLY", digitalRequired: "205.85", cashRequired: "0.00" },
      { mode: "FULL_COD", digitalRequired: "0.00", cashRequired: "205.85" },
    ]);
    expect(result.body.cod).toMatchObject({ eligible: true, amountDueAtDelivery: "205.85" });
    expect(mocks.breakdown).toHaveBeenCalledWith(expect.objectContaining({ storeId: null, orderType: "PARCEL_DOCUMENT" }));
  });
  it("explains why cash is unavailable rather than silently showing only online payment", async () => {
    mocks.breakdown.mockRejectedValue(new PaymentPolicyError("PAYMENT_POLICY_NOT_CONFIGURED", "No active payment policy matches this order."));
    const result = await read();
    expect(result.status).toBe(200);
    expect(result.body.methods).toHaveLength(1);
    expect(result.body.cod).toMatchObject({ eligible: false, reasonCode: "NOT_ENABLED" });
    expect(result.body.cod.message).toMatch(/not.*enabled|not.*available/i);
  });
  it("distinguishes the customer-visible cap from unapproved cash operations", async () => {
    mocks.breakdown.mockRejectedValue(new PaymentPolicyError("COD_LIMIT_EXCEEDED", "Required cash exceeds the configured maximum."));
    expect((await read()).body.cod).toMatchObject({ eligible: false, reasonCode: "LIMIT_EXCEEDED" });
    mocks.breakdown.mockRejectedValue(new PaymentPolicyError("COD_PRODUCTION_APPROVAL_REQUIRED", "Awaiting independent approval."));
    expect((await read()).body.cod).toMatchObject({ eligible: false, reasonCode: "APPROVAL_PENDING" });
  });
});
