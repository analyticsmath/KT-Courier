import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const dependencies = vi.hoisted(() => ({ review: vi.fn(), legal: vi.fn() }));
vi.mock("@/lib/marketplace-checkout/composition-root", () => ({ executeMarketplaceCheckoutReview: dependencies.review }));
vi.mock("@/lib/marketplace-checkout/legal-evidence", () => ({ resolveMarketplaceLegalEvidence: dependencies.legal }));
vi.mock("@/lib/marketplace-checkout/api-policy", async (original) => ({ ...await original<typeof import("@/lib/marketplace-checkout/api-policy")>(), enforceMarketplaceMutation: async () => null, marketplaceOwner: async () => ({ type: "GUEST", guestTokenHash: "owned" }) }));
import { POST } from "@/app/api/checkout/[reference]/review/route";
const request = () => new NextRequest("http://localhost:3000/api/checkout/owned/review", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ checkoutVersion: 2, operationId: "op-review-public-123", requestHash: "hash-review-public-123456789" }) });
beforeEach(() => {
  vi.clearAllMocks();
  dependencies.legal.mockResolvedValue({ termsVersion: "published-terms:hash", privacyVersion: "published-privacy:hash", refundPolicyReferences: ["published-refunds:hash"] });
  dependencies.review.mockResolvedValue({ status: "READY_FOR_REVIEW", reviewVersion: 1, commercialFingerprint: "commercial-evidence", merchandiseSubtotal: "1500.00", modifierSubtotal: "0.00", deliveryFeeTotal: "89.00", promotionDiscount: "0.00", grandTotal: "1589.00", changes: [], quotes: [], revalidatedGroups: [{ lines: [{ inventoryItemId: "private-inventory", inventoryLocationId: "private-location" }] }], promotionEvidence: { privatePolicy: "private-promotion" } });
});
describe("public review evidence", () => {
  it("returns canonical review totals and legal references without internal inventory or promotion evidence", async () => {
    const response = await POST(request(), { params: Promise.resolve({ reference: "owned" }) });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({ reviewVersion: 1, grandTotal: "1589.00", legalEvidence: { termsVersion: "published-terms:hash" } });
    expect(body).not.toHaveProperty("revalidatedGroups"); expect(body).not.toHaveProperty("promotionEvidence");
    expect(JSON.stringify(body)).not.toContain("private-");
  });
  it("reports absent published policy as unavailable and supplies no invented legal references", async () => {
    const { MarketplaceCheckoutError } = await import("@/lib/marketplace-checkout/errors");
    dependencies.legal.mockRejectedValue(new MarketplaceCheckoutError("CHECKOUT_LEGAL_BLOCKED", "Published policies are required."));
    const response = await POST(request(), { params: Promise.resolve({ reference: "owned" }) });
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ code: "CHECKOUT_LEGAL_BLOCKED" });
  });
  it("rejects client supplied totals before executing the review authority", async () => {
    const forged = new NextRequest("http://localhost:3000/api/checkout/owned/review", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ checkoutVersion: 2, operationId: "op-forged-total-123", requestHash: "hash-forged-total-123456789", grandTotal: "0.01" }) });
    const response = await POST(forged, { params: Promise.resolve({ reference: "owned" }) });
    expect(response.status).toBe(422);
    expect(dependencies.review).not.toHaveBeenCalled();
  });
});
