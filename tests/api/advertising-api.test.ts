import { describe, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";
import * as adminAuth from "@/lib/auth/admin-api";
import * as currentUserAuth from "@/lib/auth/current-user";
import { GET as getPlacements, POST as postPlacements } from "@/app/api/admin/ads/placements/route";
import { GET as getStoreCampaigns, POST as postStoreCampaigns } from "@/app/api/store/ads/campaigns/route";
import { UserRole } from "@/types/db";

vi.mock("@/lib/auth/admin-api", () => ({
  requireAdminApiPermission: vi.fn(),
}));

vi.mock("@/lib/auth/current-user", () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    advertisingPlacementDefinition: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
    advertisingCampaign: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
  },
}));

describe("Phase 24: Advertising API Endpoint Tests", () => {
  it("GET /api/admin/ads/placements returns unauthorized/forbidden response if permissions check fails", async () => {
    // Mock permission failure
    vi.mocked(adminAuth.requireAdminApiPermission).mockResolvedValueOnce({
      response: new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 })
    } as any);

    const req = new NextRequest("http://localhost/api/admin/ads/placements");
    const response = await getPlacements(req);
    expect(response.status).toBe(403);
  });

  it("POST /api/store/ads/campaigns returns unauthorized if user session is missing", async () => {
    vi.mocked(currentUserAuth.getCurrentUser).mockResolvedValueOnce(null);

    const req = new NextRequest("http://localhost/api/store/ads/campaigns", {
      method: "POST",
      body: JSON.stringify({ name: "Draft campaign" })
    });
    const response = await postStoreCampaigns(req);
    expect(response.status).toBe(401);
  });

  it("POST /api/store/ads/campaigns returns forbidden if user role is not STORE", async () => {
    vi.mocked(currentUserAuth.getCurrentUser).mockResolvedValueOnce({
      id: "user-1",
      role: UserRole.DRIVER,
      name: "Driver"
    } as any);

    const req = new NextRequest("http://localhost/api/store/ads/campaigns", {
      method: "POST",
      body: JSON.stringify({ name: "Draft campaign" })
    });
    const response = await postStoreCampaigns(req);
    expect(response.status).toBe(403);
  });
});
