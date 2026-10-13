import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ prior: vi.fn(), create: vi.fn(), audit: vi.fn(), lock: vi.fn() }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { $transaction: async (work: (tx: unknown) => unknown) => work({ $executeRaw: mocks.lock, deliveryRegion: { findUnique: mocks.prior, create: mocks.create }, adminActivityLog: { create: mocks.audit } }) } }));
import { activateOwnerApprovedGautengCoverage, GAUTENG_PROVINCE_REGION_SLUG } from "@/lib/commercial/owner-approved-gauteng-coverage";
beforeEach(() => { vi.resetAllMocks(); mocks.prior.mockResolvedValue(null); mocks.create.mockResolvedValue({ id: "new-region" }); });

describe("owner-approved Gauteng activation", () => {
  it("creates an audited province-wide region without fake radius or tariffs", async () => {
    expect(await activateOwnerApprovedGautengCoverage("authorized-actor")).toEqual({ regionId: "new-region", activated: true });
    expect(mocks.create).toHaveBeenCalledWith({ data: expect.objectContaining({ slug: GAUTENG_PROVINCE_REGION_SLUG, province: "Gauteng", coverageMode: "PROVINCE", active: true, pricingEnabled: true, centerLat: null, centerLng: null, coverageRadiusKm: null, maxDistanceKm: null, baseFee: null, highRiskSurcharge: null }) });
    expect(mocks.audit).toHaveBeenCalledWith({ data: expect.objectContaining({ actorUserId: "authorized-actor", entityId: "new-region", action: "CREATE" }) });
  });
  it("does nothing on an idempotent rerun", async () => {
    mocks.prior.mockResolvedValue({ id: "existing", coverageMode: "PROVINCE", province: "Gauteng", active: true, pricingEnabled: true, maxDistanceKm: null });
    expect(await activateOwnerApprovedGautengCoverage("authorized-actor")).toEqual({ regionId: "existing", activated: false });
    expect(mocks.create).not.toHaveBeenCalled(); expect(mocks.audit).not.toHaveBeenCalled();
  });
  it.each([{ active: false }, { pricingEnabled: false }, { coverageMode: "RADIUS" }, { province: "North West" }, { maxDistanceKm: 50 }])("preserves conflicting operator configuration", async changed => {
    mocks.prior.mockResolvedValue({ id: "existing", coverageMode: "PROVINCE", province: "Gauteng", active: true, pricingEnabled: true, maxDistanceKm: null, ...changed });
    await expect(activateOwnerApprovedGautengCoverage("authorized-actor")).rejects.toThrow("no automatic overwrite");
    expect(mocks.create).not.toHaveBeenCalled(); expect(mocks.audit).not.toHaveBeenCalled();
  });
});
