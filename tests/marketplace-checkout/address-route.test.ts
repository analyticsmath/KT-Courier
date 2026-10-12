import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const update = vi.hoisted(() => vi.fn());
vi.mock("@/lib/marketplace-checkout/checkout.service", () => ({ updateMarketplaceCheckoutAddress: update }));
vi.mock("@/lib/marketplace-checkout/api-policy", async (original) => ({
  ...await original<typeof import("@/lib/marketplace-checkout/api-policy")>(),
  enforceMarketplaceMutation: async () => null,
  marketplaceOwner: async () => ({ type: "GUEST", guestTokenHash: "disposable-owner" }),
}));
import { PUT } from "@/app/api/checkout/[reference]/delivery-address/route";
const body = { recipientName: "Disposable recipient", line1: "10 Test Street", city: "Johannesburg", province: "Gauteng", operationId: "disposable-address-1", requestHash: "a".repeat(64), checkoutVersion: 1 };
const send = (extra: Record<string, unknown>) => PUT(new NextRequest("http://localhost:3000/api/checkout/CHK-DISPOSABLE/delivery-address", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body, ...extra }) }), { params: Promise.resolve({ reference: "CHK-DISPOSABLE" }) });
beforeEach(() => { vi.clearAllMocks(); update.mockResolvedValue({ reference: "CHK-DISPOSABLE", publicReference: "CHK-DISPOSABLE", version: 2, status: "VALIDATING", checkout: {} }); });
describe("checkout optional address fields", () => {
  it("accepts omitted or blank optional fields from the form", async () => {
    expect((await send({ line2: "", suburb: "  ", deliveryInstructions: "", postalCode: "2001" })).status).toBe(200);
    expect(update.mock.calls[0][0].address).toMatchObject({ line2: undefined, suburb: undefined, deliveryInstructions: undefined, postalCode: "2001" });
  });
  it("continues to reject wrong types and client-authored fees without a mutation", async () => {
    expect((await send({ line2: 12 })).status).toBe(422);
    expect((await send({ deliveryFee: "0.01" })).status).toBe(422);
    expect(update).not.toHaveBeenCalled();
  });
});
