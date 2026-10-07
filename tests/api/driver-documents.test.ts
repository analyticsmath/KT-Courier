import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { DriverDocumentError } from "@/lib/driver-documents/errors";
const mocks = vi.hoisted(() => ({ user: vi.fn(), origin: vi.fn(), list: vi.fn(), attach: vi.fn() }));
vi.mock("@/lib/auth/current-user", () => ({ getCurrentUser: mocks.user }));
vi.mock("@/lib/security/request-origin", () => ({ enforceSameOriginRequest: mocks.origin }));
vi.mock("@/lib/services/driver-profile.service", () => ({ listOwnDriverDocuments: mocks.list, attachOwnDriverDocument: mocks.attach }));
import { GET, POST } from "@/app/api/driver/documents/route";
const body = { documentType: "LICENSE", privateMediaReference: "PMO-12345678-1234-1234-1234-123456789abc", expiresAt: null };
const request = (data: unknown = body) => new NextRequest("http://localhost:3000/api/driver/documents", { method: "POST", headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" }, body: JSON.stringify(data) });
beforeEach(() => {
  vi.resetAllMocks(); mocks.user.mockResolvedValue({ id: "owned-driver-user", role: "DRIVER" }); mocks.origin.mockResolvedValue(null);
  mocks.list.mockResolvedValue([]); mocks.attach.mockResolvedValue({ id: "document", status: "SUBMITTED" });
});
describe("driver document API privacy and authority", () => {
  it("denies missing and wrong-role sessions before accessing documents", async () => {
    for (const [user, status] of [[null, 401], [{ id: "foreign", role: "CUSTOMER" }, 403]] as const) {
      mocks.user.mockResolvedValue(user);
      expect((await GET()).status).toBe(status); expect((await POST(request())).status).toBe(status);
    }
    expect(mocks.list).not.toHaveBeenCalled(); expect(mocks.attach).not.toHaveBeenCalled();
  });
  it("rejects wrong origins before session lookup or attachment", async () => {
    mocks.origin.mockResolvedValue(NextResponse.json({ error: "Invalid request origin" }, { status: 403 }));
    const response = await POST(request()); expect(response.status).toBe(403); expect(response.headers.get("cache-control")).toContain("no-store");
    expect(mocks.user).not.toHaveBeenCalled(); expect(mocks.attach).not.toHaveBeenCalled();
  });
  it("rejects supplied ownership and vehicle document types at the driver endpoint", async () => {
    for (const data of [{ ...body, driverUserId: "foreign" }, { ...body, documentType: "VEHICLE_REGISTRATION" }, { ...body, privateMediaReference: "invalid" }]) {
      expect((await POST(request(data))).status).toBe(422);
    }
    expect(mocks.attach).not.toHaveBeenCalled();
  });
  it("derives the owner from the session and returns private document responses", async () => {
    const response = await POST(request()); expect(response.status).toBe(201);
    expect(mocks.attach).toHaveBeenCalledWith({ ...body, driverUserId: "owned-driver-user" });
    expect(await response.json()).toEqual({ id: "document", status: "SUBMITTED" });
    expect(response.headers.get("cache-control")).toBe("private, no-store"); expect(response.headers.get("vary")).toBe("Cookie");
    const list = await GET(); expect(await list.json()).toEqual([]); expect(mocks.list).toHaveBeenCalledWith("owned-driver-user"); expect(list.headers.get("cache-control")).toContain("no-store");
  });
  it.each([["PROFILE_NOT_FOUND", 404], ["MEDIA_INVALID", 422], ["MEDIA_ALREADY_ATTACHED", 409]] as const)("returns the typed %s refusal with private caching", async (code, status) => {
    mocks.attach.mockRejectedValue(new DriverDocumentError(code));
    const response = await POST(request()); expect(response.status).toBe(status); expect(response.headers.get("cache-control")).toContain("no-store"); expect(await response.json()).toMatchObject({ code });
  });
  it("never exposes unexpected database or provider details on either route", async () => {
    mocks.list.mockRejectedValue(new Error("PRIVATE_DATABASE_DETAIL")); mocks.attach.mockRejectedValue(new Error("PRIVATE_PROVIDER_DETAIL"));
    for (const response of [await GET(), await POST(request())]) {
      expect(response.status).toBe(503); expect(response.headers.get("cache-control")).toContain("no-store");
      expect(await response.json()).toEqual({ error: "Driver documents are temporarily unavailable. Please try again." });
    }
  });
});
