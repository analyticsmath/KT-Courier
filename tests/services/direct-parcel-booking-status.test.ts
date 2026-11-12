import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import { OrderStatus } from "@/types/db";

const mocks = vi.hoisted(() => ({
  quote: vi.fn(),
  policy: vi.fn(),
  cash: vi.fn(),
  confirmed: vi.fn(),
  storeAccess: vi.fn(),
}));
vi.mock("@/lib/services/pricing-quote.service", () => ({
  ownedActiveQuoteForOrder: mocks.quote,
}));
vi.mock("@/lib/payments/payment-policy.service", async (original) => ({
  ...(await original()),
  resolvePaymentBreakdown: mocks.policy,
}));
vi.mock("@/lib/services/cash-on-delivery.service", () => ({
  createCashOnDeliveryObligationWithinTransaction: mocks.cash,
}));
vi.mock("@/lib/services/notification-events.service", () => ({
  appendOrderConfirmedInTx: mocks.confirmed,
}));
vi.mock("@/lib/client-platform/store-access", () => ({
  storeAccess: mocks.storeAccess,
}));
vi.mock("@/lib/utils/order-number", () => ({
  generateOrderNumber: () => "KT-TEST-BOOKING",
}));
vi.mock("@/lib/pricing/input-hash", () => ({
  hashPricingInput: () => "test-quote-hash",
  pricingInputSnapshot: () => ({}),
}));
vi.mock("@/lib/dto/order.dto", () => ({
  toOrderDetailDto: (row: unknown) => row,
}));
import { createOrder } from "@/lib/services/orders.service";

const customer = {
  id: "customer-1", role: "CUSTOMER", email: "customer@example.test", status: "ACTIVE",
};
const business = {
  id: "store-owner-1", role: "STORE", email: "merchant@example.test", status: "ACTIVE",
};
const input = {
  pricingQuoteId: "quote-1",
  deliveryType: "PARCEL_DOCUMENT",
  pickupAddress: {
    line1: "Collection street", city: "Johannesburg", province: "Gauteng",
  },
  dropoffAddress: {
    line1: "Destination street", city: "Pretoria", province: "Gauteng",
  },
  recipientName: "Test recipient",
  recipientPhone: "+27110000001",
  recipientEmail: "recipient@example.test",
  parcelCount: 1,
};
const quoted = {
  id: "quote-1",
  ruleSnapshot: { serviceKey: "STANDARD", configurationId: "service-1" },
  inputSnapshot: {},
  regionSnapshot: {},
  taxSnapshot: {},
  metadata: null,
  currency: "ZAR",
  destinationRegionId: "gauteng-1",
  originRegionId: "gauteng-1",
  total: new Prisma.Decimal("170.00"),
  subtotal: new Prisma.Decimal("170.00"),
  taxAmount: new Prisma.Decimal("0.00"),
  taxRate: new Prisma.Decimal("0.00"),
  lineItems: [],
  calculationVersion: "client-delivery-v1",
  distanceMeters: 1234,
  durationSeconds: 600,
  routeProvider: "TEST",
  createdAt: new Date("2026-11-12T00:00:00Z"),
};
function transaction() {
  const tx = {
    address: { create: vi.fn().mockResolvedValueOnce({ id: "pickup-1" }).mockResolvedValueOnce({ id: "dropoff-1" }) },
    order: { create: vi.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ id: "order-1", ...data })) },
    orderStatusHistory: { create: vi.fn().mockResolvedValue({}) },
  };
  return tx;
}
function cashPolicy(mode: "FULL_COD" | "DEPOSIT_PLUS_COD") {
  return {
    mode,
    policyId: "approved-1",
    policyVersion: 1,
    authoritativeTotal: "170.00",
    digitalRequired: mode === "FULL_COD" ? "0.00" : "85.00",
    cashRequired: mode === "FULL_COD" ? "170.00" : "85.00",
    policyEvidence: { approved: true },
  };
}

describe("source-bound direct parcel booking status in the same transaction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.quote.mockResolvedValue(quoted);
    mocks.storeAccess.mockResolvedValue({ store: { id: "store-1" } });
    mocks.cash.mockResolvedValue({});
    mocks.confirmed.mockResolvedValue({});
  });

  it("accepts a fully scoped and approved cash-on-delivery booking for driver dispatch", async () => {
    mocks.policy.mockResolvedValue(cashPolicy("FULL_COD"));
    const tx = transaction();
    const order = await createOrder(customer as never, { ...input, paymentMethod: "FULL_COD" } as never, false, tx as never);
    expect(order).toMatchObject({ status: OrderStatus.CONFIRMED, source: "CUSTOMER" });
    expect(tx.order.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: OrderStatus.CONFIRMED }) }));
    expect(tx.orderStatusHistory.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: OrderStatus.CONFIRMED }) }));
    expect(mocks.cash).toHaveBeenCalledWith(tx, expect.objectContaining({
      orderId: "order-1", policyMode: "FULL_COD", digitalRequired: "0.00",
    }));
    expect(mocks.confirmed).toHaveBeenCalledOnce();
  });

  it("allows store-originated full COD only under the same validated policy", async () => {
    mocks.policy.mockResolvedValue(cashPolicy("FULL_COD"));
    const tx = transaction();
    const order = await createOrder(business as never, { ...input, paymentMethod: "FULL_COD" } as never, true, tx as never);
    expect(order).toMatchObject({ status: OrderStatus.CONFIRMED, storeId: "store-1", source: "STORE" });
    expect(mocks.storeAccess).toHaveBeenCalledWith("store-owner-1", "deliveries");
    expect(mocks.policy).toHaveBeenCalledWith(expect.objectContaining({ storeId: "store-1" }), tx);
  });

  it("does not confirm unpaid online or deposit-only bookings", async () => {
    for (const method of ["DIGITAL_ONLY", "DEPOSIT_PLUS_COD"] as const) {
      mocks.policy.mockResolvedValue(cashPolicy("DEPOSIT_PLUS_COD"));
      const tx = transaction();
      const order = await createOrder(customer as never, { ...input, paymentMethod: method } as never, false, tx as never);
      expect(order).toMatchObject({ status: OrderStatus.PENDING });
      expect(tx.orderStatusHistory.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: OrderStatus.PENDING }) }));
      if (method === "DIGITAL_ONLY") expect(mocks.cash).not.toHaveBeenCalled();
      else expect(mocks.cash).toHaveBeenCalledWith(tx, expect.objectContaining({ policyMode: "DEPOSIT_PLUS_COD", digitalRequired: "85.00" }));
      mocks.cash.mockClear();
    }
  });

  it("rejects a different unapproved cash choice before creating an order", async () => {
    mocks.policy.mockResolvedValue(cashPolicy("FULL_COD"));
    const tx = transaction();
    await expect(createOrder(customer as never, { ...input, paymentMethod: "DEPOSIT_PLUS_COD" } as never, false, tx as never))
      .rejects.toMatchObject({ code: "PAYMENT_METHOD_NOT_ALLOWED" });
    expect(tx.order.create).not.toHaveBeenCalled();
    expect(mocks.cash).not.toHaveBeenCalled();
  });
});
