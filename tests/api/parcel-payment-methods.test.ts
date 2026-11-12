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
  metadata: { bookingInput: {
    pickupAddress: { city: "Johannesburg", line2: "Hillbrow", province: "Gauteng" },
    dropoffAddress: { city: "Pretoria", line2: "Sunnyside", province: "Gauteng" },
  } },
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
    expect(mocks.breakdown).toHaveBeenCalledWith(expect.objectContaining({
      originLocality: { city: "Johannesburg", suburb: "Hillbrow", province: "Gauteng" },
      destinationLocality: { city: "Pretoria", suburb: "Sunnyside", province: "Gauteng" },
    }));
  });
  it("shows a 50/50 deposit only when the approved store policy returns it", async () => {
    mocks.user.mockResolvedValue({ id: "store-owner", role: "STORE", status: "ACTIVE" });
    mocks.storeAccess.mockResolvedValue({ store: { id: "store-abc" }, owner: true });
    mocks.breakdown.mockResolvedValue({
      mode: "DEPOSIT_PLUS_COD", digitalRequired: "102.93", cashRequired: "102.92",
    });
    const requestForStore = { headers: new Headers({ "X-KT-Workspace": "STORE" }) } as never;
    const response = await GET(requestForStore, context);
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.methods).toEqual([
      { mode: "DIGITAL_ONLY", digitalRequired: "205.85", cashRequired: "0.00" },
      { mode: "DEPOSIT_PLUS_COD", digitalRequired: "102.93", cashRequired: "102.92" },
    ]);
    expect(body.cod).toMatchObject({ eligible: true, amountDueAtDelivery: "102.92" });
    expect(mocks.breakdown).toHaveBeenCalledWith(expect.objectContaining({ storeId: "store-abc", orderType: "PARCEL_DOCUMENT" }));
  });
  it("suppresses cash at the quote choice screen when a trusted suburb is high risk", async () => {
    mocks.breakdown.mockRejectedValue(new PaymentPolicyError("HIGH_RISK_CASH_RESTRICTED", "Cash is not allowed in the selected area."));
    const result = await read();
    expect(result.status).toBe(200);
    expect(result.body.methods).toEqual([
      { mode: "DIGITAL_ONLY", digitalRequired: "205.85", cashRequired: "0.00" },
    ]);
    expect(result.body.cod).toMatchObject({ eligible: false, reasonCode: "HIGH_RISK_AREA" });
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
