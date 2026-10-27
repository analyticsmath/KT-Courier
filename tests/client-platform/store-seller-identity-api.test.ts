import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { GET, POST } from "@/app/api/store/seller-identity/route";
import { POST as review } from "@/app/api/admin/stores/[id]/seller-identity/route";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
const state = vi.hoisted(() => ({ business: vi.fn(), access: vi.fn(), current: vi.fn(), admin: vi.fn(), submit: vi.fn(), review: vi.fn(), read: vi.fn(), origin: vi.fn(), rate: vi.fn() }));
vi.mock("@/lib/client-platform/business-auth", () => ({ requireBusinessApi: state.business }));
vi.mock("@/lib/client-platform/store-access", () => ({ storeAccess: state.access }));
vi.mock("@/lib/auth/current-user", () => ({ getCurrentUser: state.current }));
vi.mock("@/lib/auth/admin-api", () => ({ requireAdminApiPermission: state.admin }));
vi.mock("@/lib/security/request-origin", () => ({ enforceSameOriginRequest: state.origin }));
vi.mock("@/lib/security/rate-limit", () => ({ checkIpRateLimit: state.rate, RATE_LIMITS: { ORDER_ESTIMATE: {} } }));
vi.mock("@/lib/services/store-seller-identity.service", () => ({ submitStoreSellerIdentity: state.submit, reviewStoreSellerIdentity: state.review, getStoreSellerIdentityState: state.read }));
const input = { operationId: "synthetic-operation", expectedIdentityReference: null, identityVersion: "v1", legalName: "Synthetic seller", vatRegistrationStatus: "NOT_REGISTERED", countryCode: "ZA", invoiceClassification: "RECEIPT", effectiveFrom: "2026-10-01T00:00:00.000Z", effectiveUntil: null, sourceEvidenceReference: "SYNTHETIC_OWNER_INPUT", confirmSuppliedDetails: true };
const command = { proposalReference: "SLP-synthetic", expectedUpdatedAt: "2026-10-01T00:00:00.000Z", operationId: "synthetic-review", action: "APPROVE", reason: "Synthetic review", evidenceReference: "SYNTHETIC_REVIEW", confirmIndependentReview: true };
const request = (body: unknown) => new NextRequest("http://localhost:3000/api/store/seller-identity", { method: "POST", headers: { origin: "http://localhost:3000", "content-type": "application/json" }, body: JSON.stringify(body) });
describe("seller identity API scope and review authority", () => {
  beforeEach(() => { vi.clearAllMocks(); state.business.mockResolvedValue(null); state.access.mockResolvedValue({ owner: true, store: { id: "owned-store" } }); state.current.mockResolvedValue({ id: "owner" }); state.admin.mockResolvedValue({ user: { id: "checker" } }); state.submit.mockResolvedValue({ reference: "SLP-synthetic" }); state.review.mockResolvedValue({ status: "APPROVED" }); state.read.mockResolvedValue({ currentIdentity: null, proposals: [] }); state.origin.mockResolvedValue(null); state.rate.mockResolvedValue({ ok: true }); });
  it("derives the store from current owner context and returns private no-store evidence", async () => {
    const response = await POST(request(input)); expect(response.status).toBe(201); expect(response.headers.get("cache-control")).toContain("no-store");
    expect(state.submit).toHaveBeenCalledWith("owned-store", "owner", input); expect((await GET()).status).toBe(200); expect(state.read).toHaveBeenCalledWith("owned-store");
  });
  it("returns an actionable identity-version validation message rather than raw regex syntax", async () => {
    const response = await POST(request({ ...input, identityVersion: "Pammy Bakes" }));
    expect(response.status).toBe(422);
    const result = await response.json();
    expect(result.error).toMatch(/letters.*numbers.*spaces/i);
    expect(result.error).not.toMatch(/\^|\$|regex|pattern/i);
    expect(state.submit).not.toHaveBeenCalled();
  });
  it("does not allow body ownership or approval injection", async () => {
    expect((await POST(request({ ...input, storeId: "foreign-store", status: "APPROVED" }))).status).toBe(422); expect(state.submit).not.toHaveBeenCalled();
  });
  it("refuses employee and revoked workspace requests before reading seller data", async () => {
    state.access.mockResolvedValue({ owner: false, store: { id: "employee-store" } }); expect((await GET()).status).toBe(403); expect((await POST(request(input))).status).toBe(403); expect(state.read).not.toHaveBeenCalled();
    state.business.mockResolvedValue(NextResponse.json({ error: "Revoked" }, { status: 403 })); expect((await POST(request(input))).status).toBe(403); expect(state.submit).not.toHaveBeenCalled();
  });
  it("refuses cross-origin, oversized and rate-limited requests without writes", async () => {
    state.origin.mockResolvedValueOnce(NextResponse.json({}, { status: 403 })); expect((await POST(request(input))).status).toBe(403);
    expect((await POST(request({ ...input, legalName: "x".repeat(20_000) }))).status).toBe(413);
    state.rate.mockResolvedValue({ ok: false, retryAfterSeconds: 5 }); expect((await POST(request(input))).status).toBe(429); expect(state.submit).not.toHaveBeenCalled();
  });
  it("requires both current store approval and legal publication grants", async () => {
    expect((await review(request(command), { params: Promise.resolve({ id: "selected-store" }) })).status).toBe(200);
    expect(state.admin).toHaveBeenCalledWith([PERMISSIONS.STORES_APPROVE, PERMISSIONS.LEGAL_DOCUMENTS_PUBLISH], { request: expect.any(NextRequest) });
    expect(state.review).toHaveBeenCalledWith("selected-store", "checker", command);
  });
  it("requires coherent supplied VAT and effective-window facts before any write", async () => {
    for (const invalid of [{ ...input, vatRegistrationStatus: "REGISTERED", vatNumber: null }, { ...input, invoiceClassification: "TAX_INVOICE" }, { ...input, effectiveUntil: input.effectiveFrom }]) expect((await POST(request(invalid))).status).toBe(422);
    expect(state.submit).not.toHaveBeenCalled();
  });
  it("refuses missing approval authority and unconfirmed independent review", async () => {
    state.admin.mockResolvedValueOnce({ response: NextResponse.json({}, { status: 403 }) }); expect((await review(request(command), { params: Promise.resolve({ id: "store" }) })).status).toBe(403);
    expect((await review(request({ ...command, confirmIndependentReview: false }), { params: Promise.resolve({ id: "store" }) })).status).toBe(422); expect(state.review).not.toHaveBeenCalled();
  });
});
