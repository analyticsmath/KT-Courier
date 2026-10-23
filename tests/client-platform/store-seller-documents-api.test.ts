import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
const f = vi.hoisted(() => ({ user: vi.fn(), business: vi.fn(), access: vi.fn(), origin: vi.fn(), rate: vi.fn(), parse: vi.fn(), upload: vi.fn() }));
vi.mock("@/lib/auth/current-user", () => ({ getCurrentUser: f.user }));
vi.mock("@/lib/client-platform/business-auth", () => ({ requireBusinessApi: f.business }));
vi.mock("@/lib/client-platform/store-access", () => ({ storeAccess: f.access }));
vi.mock("@/lib/security/request-origin", () => ({ enforceSameOriginRequest: f.origin }));
vi.mock("@/lib/security/rate-limit", () => ({ checkIpRateLimit: f.rate, RATE_LIMITS: { PRIVATE_MEDIA_UPLOAD: {} } }));
vi.mock("@/lib/security/bounded-upload", () => ({ parseBoundedMultipartRequest: f.parse }));
vi.mock("@/lib/private-media/private-media.service", async original => ({ ...await original<typeof import("@/lib/private-media/private-media.service")>(), PrivateMediaService: class { upload = f.upload; } }));
import { POST } from "@/app/api/store/seller-identity/documents/route";
import { PrivateMediaPolicyError } from "@/lib/private-media/private-media.service";
const request = () => new NextRequest("http://localhost/api/store/seller-identity/documents", { method: "POST" });
const file = { sanitizedName: "verification.pdf", type: "application/pdf", bytes: new Uint8Array([1, 2, 3]) };
describe("seller verification file intake", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    f.user.mockResolvedValue({ id: "owner", role: "STORE", status: "ACTIVE" });
    f.business.mockResolvedValue(null); f.origin.mockResolvedValue(null);
    f.access.mockResolvedValue({ owner: true, store: { id: "owned-store" } });
    f.rate.mockResolvedValue({ ok: true });
    f.parse.mockResolvedValue({ result: { files: { file }, fields: { ownerId: "foreign-store", purpose: "OTHER" } } });
    f.upload.mockResolvedValue({ publicReference: "PMO-test", status: "READY" });
  });
  it("derives ownership and purpose on the server, ignoring submitted scope", async () => {
    const response = await POST(request());
    expect(response.status).toBe(201); expect(response.headers.get("cache-control")).toContain("private, no-store");
    expect(f.upload).toHaveBeenCalledWith({ actor: { userId: "owner", role: "STORE" }, ownerType: "STORE", ownerId: "owned-store", purpose: "STORE_VERIFICATION_DOCUMENT", fileName: file.sanitizedName, mimeType: file.type, bytes: file.bytes });
    expect(f.parse).toHaveBeenCalledWith(expect.any(NextRequest), expect.objectContaining({ maxFiles: 1, maxSizeBytes: 10 * 1024 * 1024 }));
  });
  it("rejects cross-origin and revoked business access before parsing files", async () => {
    f.origin.mockResolvedValueOnce(NextResponse.json({}, { status: 403 }));
    expect((await POST(request())).status).toBe(403);
    f.business.mockResolvedValue(NextResponse.json({}, { status: 403 }));
    expect((await POST(request())).status).toBe(403); expect(f.parse).not.toHaveBeenCalled(); expect(f.upload).not.toHaveBeenCalled();
  });
  it("requires an active owner rather than a staff membership", async () => {
    f.user.mockResolvedValueOnce(null);
    expect((await POST(request())).status).toBe(401);
    f.user.mockResolvedValueOnce({ id: "owner", role: "STORE", status: "SUSPENDED" });
    expect((await POST(request())).status).toBe(401);
    f.access.mockResolvedValue({ owner: false, store: { id: "staff-store" } });
    expect((await POST(request())).status).toBe(403); expect(f.upload).not.toHaveBeenCalled();
  });
  it("enforces rate and bounded-upload errors without persisting evidence", async () => {
    f.rate.mockResolvedValueOnce({ ok: false });
    expect((await POST(request())).status).toBe(429); expect(f.parse).not.toHaveBeenCalled();
    f.parse.mockResolvedValue({ errorResponse: NextResponse.json({}, { status: 413 }) });
    expect((await POST(request())).status).toBe(413); expect(f.upload).not.toHaveBeenCalled();
  });
  it("requires a file and reports unavailable private storage truthfully", async () => {
    f.parse.mockResolvedValueOnce({ result: { files: {}, fields: {} } });
    expect((await POST(request())).status).toBe(422);
    f.upload.mockRejectedValue(new PrivateMediaPolicyError("PRIVATE_MEDIA_STORAGE_NOT_CONFIGURED", 503, "Private media storage is unavailable."));
    expect((await POST(request())).status).toBe(503);
  });
});
