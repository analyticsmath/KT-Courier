import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
const create = vi.hoisted(() => vi.fn());
vi.mock("@/lib/marketplace-checkout/checkout.service", async (original) => ({ ...await original<typeof import("@/lib/marketplace-checkout/checkout.service")>(), createMarketplaceCheckout: create }));
vi.mock("@/lib/marketplace-checkout/api-policy", async (original) => ({ ...await original<typeof import("@/lib/marketplace-checkout/api-policy")>(), enforceMarketplaceMutation: async () => null, marketplaceOwner: async () => ({ type: "GUEST", guestTokenHash: "owned" }) }));
import { POST } from "@/app/api/checkout/route";
beforeEach(() => vi.clearAllMocks());
describe("created checkout public projection", () => {
  it("serializes decimal totals consistently and excludes internal ownership and fingerprints", async () => {
    create.mockResolvedValue({ id: "internal", publicReference: "checkout-public", status: "CREATED", currency: "ZAR", version: 1, grandTotal: new Prisma.Decimal(1500), merchandiseSubtotal: new Prisma.Decimal(1500), guestAccessTokenHash: "private-guest-hash", commercialFingerprint: "private-fingerprint", storeGroups: [] });
    const response = await POST(new NextRequest("http://localhost:3000/api/checkout", { method: "POST", headers: { "Content-Type": "application/json", cookie: "kt_marketplace_cart=test-only-guest" }, body: JSON.stringify({ cartReference: "cart-public" }) }));
    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.checkout).toMatchObject({ reference: "checkout-public", totals: { merchandiseSubtotal: "1500.00", grandTotal: "1500.00", deliveryFeeTotal: "0.00" }, storeGroups: [] });
    expect(JSON.stringify(body)).not.toContain("private-"); expect(body.checkout.id).toBeUndefined();
  });
});
