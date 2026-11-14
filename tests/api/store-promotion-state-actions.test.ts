import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const mock = vi.hoisted(() => ({ origin: vi.fn(), workspace: vi.fn(), user: vi.fn(), store: vi.fn(), gate: vi.fn(), pause: vi.fn(), end: vi.fn() }));
vi.mock("@/lib/security/request-origin", () => ({ enforceSameOriginRequest: mock.origin }));
vi.mock("@/lib/client-platform/business-auth", () => ({ requireBusinessApi: mock.workspace }));
vi.mock("@/lib/auth/current-user", () => ({ getCurrentUser: mock.user }));
vi.mock("@/lib/auth/store-context", () => ({ getStoreForUser: mock.store }));
vi.mock("@/lib/promotions/production-lock", () => ({ assertPromotionsProductionReady: mock.gate }));
vi.mock("@/lib/promotions/store-promotions.service", () => ({ pauseStoreCampaign: mock.pause, endStoreCampaign: mock.end }));
import { POST as pause } from "@/app/api/store/promotions/[reference]/pause/route";
import { POST as end } from "@/app/api/store/promotions/[reference]/end/route";

const context = { params: Promise.resolve({ reference: "promotion-ref" }) };
const request = () => new NextRequest("https://local/api/store/promotions/promotion-ref/pause", { method: "POST" });
beforeEach(() => { vi.clearAllMocks(); mock.origin.mockResolvedValue(null); mock.workspace.mockResolvedValue(null); mock.user.mockResolvedValue({ id: "store-user" }); mock.store.mockResolvedValue({ id: "store-id" }); mock.pause.mockResolvedValue({ status: "PAUSED" }); mock.end.mockResolvedValue({ status: "ENDED" }); });

it("blocks cross-origin mutations before accessing the store", async () => {
  mock.origin.mockResolvedValue(NextResponse.json({}, { status: 403 }));
  expect((await pause(request(), context)).status).toBe(403);
  expect((await end(request(), context)).status).toBe(403);
  expect(mock.workspace).not.toHaveBeenCalled();
});

it("passes the authorized store and actual actor to both actions", async () => {
  expect((await pause(request(), context)).status).toBe(200);
  expect((await end(request(), context)).status).toBe(200);
  expect(mock.store).toHaveBeenCalledWith("store-user", undefined, "marketing");
  expect(mock.pause).toHaveBeenCalledWith("store-id", "promotion-ref", "store-user");
  expect(mock.end).toHaveBeenCalledWith("store-id", "promotion-ref", "store-user");
});
