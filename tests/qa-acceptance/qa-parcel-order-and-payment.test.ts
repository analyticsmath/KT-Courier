import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  enforceSameOriginRequest: vi.fn(),
  getCurrentUser: vi.fn(),
  checkIpRateLimit: vi.fn(),
  createOrder: vi.fn(),
  resolveQaAcceptanceSessionContext: vi.fn(),
}));

vi.mock("@/lib/security/request-origin", () => ({
  enforceSameOriginRequest: mocks.enforceSameOriginRequest,
}));

vi.mock("@/lib/auth/current-user", () => ({
  getCurrentUser: mocks.getCurrentUser,
}));

vi.mock("@/lib/security/rate-limit", async () => {
  const actual = await vi.importActual<typeof import("@/lib/security/rate-limit")>(
    "@/lib/security/rate-limit",
  );
  return {
    ...actual,
    checkIpRateLimit: mocks.checkIpRateLimit,
  };
});

vi.mock("@/lib/services/orders.service", () => ({
  createOrder: mocks.createOrder,
  listOrders: vi.fn(),
}));

vi.mock("@/lib/qa-acceptance/access", () => ({
  resolveQaAcceptanceSessionContext: mocks.resolveQaAcceptanceSessionContext,
}));

import { POST } from "@/app/api/orders/route";

function validOrderBody() {
  return {
    deliveryType: "PARCEL_DOCUMENT",
    pricingQuoteId: "cm1234567890abcdefghijklm",
    senderEmail: "sender@ktcouriers.com",
    pickupAddress: {
      contactName: "QA Customer",
      contactPhone: "+27820001001",
      line1: "14 Commissioner Street",
      city: "Johannesburg",
      province: "Gauteng",
      country: "South Africa",
    },
    dropoffAddress: {
      contactName: "QA Recipient",
      contactPhone: "+27820002002",
      line1: "72 Rivonia Road",
      city: "Sandton",
      province: "Gauteng",
      country: "South Africa",
    },
    recipientName: "QA Recipient",
    recipientPhone: "+27820002002",
    recipientEmail: "recipient@ktcouriers.com",
    parcelCount: 1,
    parcelDescription: "QA Sealed Box",
    paymentMethod: "DIGITAL_ONLY",
  };
}

describe("POST /api/orders Issue #40 QA lane wiring", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.enforceSameOriginRequest.mockResolvedValue(null);
    mocks.checkIpRateLimit.mockResolvedValue({ ok: true, remaining: 10, retryAfterSeconds: 60 });
    mocks.getCurrentUser.mockResolvedValue({
      id: "usr_qa_cust",
      email: "qa.cust@ktcouriers.com",
      role: "CUSTOMER",
      status: "ACTIVE",
    });
    mocks.createOrder.mockResolvedValue({
      id: "ord_qa_1",
      orderNumber: "KT-2026-000101",
    });
  });

  it("tags direct parcel orders with isQaAcceptance when caller has an active QA session context", async () => {
    mocks.resolveQaAcceptanceSessionContext.mockResolvedValueOnce({
      activeRunId: "qarun_123",
    });

    const req = new NextRequest("https://www.ktcouriers.com/api/orders", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(validOrderBody()),
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    expect(mocks.createOrder).toHaveBeenCalledWith(
      expect.objectContaining({ id: "usr_qa_cust" }),
      expect.any(Object),
      false,
      undefined,
      undefined,
      { isQaAcceptance: true, qaAcceptanceRunId: "qarun_123" },
    );
  });

  it("leaves qaAcceptance undefined for ordinary customer orders", async () => {
    mocks.resolveQaAcceptanceSessionContext.mockResolvedValueOnce(null);

    const req = new NextRequest("https://www.ktcouriers.com/api/orders", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(validOrderBody()),
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    expect(mocks.createOrder).toHaveBeenCalledWith(
      expect.objectContaining({ id: "usr_qa_cust" }),
      expect.any(Object),
      false,
      undefined,
      undefined,
      undefined,
    );
  });
});
