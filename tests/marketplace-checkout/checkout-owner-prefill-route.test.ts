import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const deps = vi.hoisted(() => ({
  owner: vi.fn(), checkout: vi.fn(), project: vi.fn(),
  addressList: vi.fn(), userFind: vi.fn(),
}));

vi.mock("@/lib/marketplace-checkout/api-policy", async (original) => ({
  ...await original<typeof import("@/lib/marketplace-checkout/api-policy")>(),
  marketplaceOwner: deps.owner,
}));
vi.mock("@/lib/marketplace-checkout/checkout.service", () => ({
  getMarketplaceCheckoutForOwner: deps.checkout,
  projectPublicCheckout: deps.project,
}));
vi.mock("@/lib/services/customer-addresses.service", () => ({
  listCustomerAddresses: deps.addressList,
}));
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    user: { findUnique: deps.userFind },
    marketplaceOrder: { findUnique: vi.fn() },
  },
}));

import { GET } from "@/app/api/checkout/[reference]/route";

const request = () => new NextRequest("https://ktcouriers.com/api/checkout/checkout-01");
const ctx = { params: Promise.resolve({ reference: "checkout-01" }) };

beforeEach(() => {
  vi.clearAllMocks();
  deps.checkout.mockResolvedValue({ id: "checkout-row", status: "CREATED" });
  deps.project.mockReturnValue({ reference: "checkout-01", status: "CREATED", totals: { grandTotal: "120.00" } });
  deps.userFind.mockResolvedValue({ name: "Customer One", email: "customer@example.test", phone: "0820001111" });
  deps.addressList.mockResolvedValue([{ id: "home", line1: "15 Example Street", storeId: null }]);
});

describe("marketplace checkout owner and address-book privacy", () => {
  it("returns the same authenticated customer's profile and saved addresses", async () => {
    deps.owner.mockResolvedValue({ type: "CUSTOMER", userId: "customer-one" });
    const response = await GET(request(), ctx);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      checkout: { reference: "checkout-01" },
      account: { name: "Customer One", email: "customer@example.test" },
      savedAddresses: [{ id: "home" }],
    });
    expect(deps.userFind).toHaveBeenCalledWith({
      where: { id: "customer-one" },
      select: { name: true, email: true, phone: true },
    });
    expect(deps.addressList).toHaveBeenCalledWith("customer-one");
    expect(response.headers.get("Cache-Control")).toContain("no-store");
  });

  it("does not retrieve or disclose any account information to a guest checkout", async () => {
    deps.owner.mockResolvedValue({ type: "GUEST", guestTokenHash: "valid-guest" });
    const response = await GET(request(), ctx);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ checkout: { reference: "checkout-01", status: "CREATED", totals: { grandTotal: "120.00" } } });
    expect(deps.userFind).not.toHaveBeenCalled();
    expect(deps.addressList).not.toHaveBeenCalled();
  });

  it("never reads a customer's address book after checkout owner authorization rejects the request", async () => {
    deps.owner.mockResolvedValue({ type: "CUSTOMER", userId: "attacker" });
    deps.checkout.mockRejectedValue(new Error("CHECKOUT_ACCESS_DENIED"));
    const response = await GET(request(), ctx);
    expect(response.status).not.toBe(200);
    expect(deps.userFind).not.toHaveBeenCalled();
    expect(deps.addressList).not.toHaveBeenCalled();
  });

  it("rejects an unauthenticated checkout without loading private data", async () => {
    deps.owner.mockResolvedValue(null);
    const response = await GET(request(), ctx);
    expect(response.status).toBe(401);
    expect(deps.checkout).not.toHaveBeenCalled();
    expect(deps.addressList).not.toHaveBeenCalled();
  });
});
