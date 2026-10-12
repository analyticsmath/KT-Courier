import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), prepare: vi.fn(), publish: vi.fn() }));
vi.mock("@/lib/catalog/catalog-auth", () => ({ requireCatalogAdminPermission: mocks.auth }));
vi.mock("@/lib/catalog/catalog-api-policy", async original => ({ ...await original<typeof import("@/lib/catalog/catalog-api-policy")>(), prepareCatalogMutation: mocks.prepare }));
vi.mock("@/lib/services/catalog-listing-publication.service", () => ({ publishApprovedCatalogListing: mocks.publish }));
import { POST } from "@/app/api/admin/catalog/offers/[id]/publish/route";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
const facts = { version: 4, productVersion: 5, priceVersionReference: "PRICE-APPROVED", operationId: "publication-operation-001", reasonCode: "REVIEWED_GOODS" };
const request = () => new NextRequest("http://localhost:3000/api/admin/catalog/offers/test-offer/publish", { method: "POST" });
const params = { params: Promise.resolve({ id: "test-offer" }) };
describe("catalog publication API exact review authority", () => {
  beforeEach(() => { vi.resetAllMocks(); mocks.auth.mockResolvedValue({ user: { id: "publisher" } }); mocks.prepare.mockResolvedValue({ body: facts }); mocks.publish.mockResolvedValue({ offer: { status: "ACTIVE" } }); });
  it.each([401, 403])("denies absent or revoked moderation authority (%i)", async status => {
    mocks.auth.mockResolvedValue({ response: new Response(null, { status }) }); expect((await POST(request(), params)).status).toBe(status); expect(mocks.publish).not.toHaveBeenCalled();
  });
  it("honors explicit pricing DENY independently of moderation authority", async () => {
    mocks.auth.mockResolvedValueOnce({ user: { id: "publisher" } }).mockResolvedValueOnce({ response: new Response(null, { status: 403 }) });
    expect((await POST(request(), params)).status).toBe(403); expect(mocks.prepare).not.toHaveBeenCalled(); expect(mocks.publish).not.toHaveBeenCalled();
    expect(mocks.auth.mock.calls.map(call => call[0])).toEqual([PERMISSIONS.CATALOG_MODERATION_APPROVE, PERMISSIONS.CATALOG_PRICING_MANAGE]);
  });
  it("refuses account changes between permission checks", async () => {
    mocks.auth.mockResolvedValueOnce({ user: { id: "first" } }).mockResolvedValueOnce({ user: { id: "second" } }); expect((await POST(request(), params)).status).toBe(403); expect(mocks.publish).not.toHaveBeenCalled();
  });
  it.each([403, 429, 413])("preserves request origin, rate and bounded-input refusals (%i)", async status => {
    mocks.prepare.mockResolvedValue({ response: new Response(null, { status }) }); expect((await POST(request(), params)).status).toBe(status); expect(mocks.publish).not.toHaveBeenCalled();
  });
  it("rejects injected approval or price amounts", async () => {
    mocks.prepare.mockResolvedValue({ body: { ...facts, approved: true, amount: "0.01" } }); expect((await POST(request(), params)).status).toBe(422); expect(mocks.publish).not.toHaveBeenCalled();
  });
  it("binds publication to exact source versions and current actor with no-store responses", async () => {
    const response = await POST(request(), params); expect(response.status).toBe(200); expect(response.headers.get("cache-control")).toContain("no-store"); expect(mocks.publish).toHaveBeenCalledWith("test-offer", "publisher", facts);
  });
});
