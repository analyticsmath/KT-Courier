import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ findMany: vi.fn(), findUnique: vi.fn(), groupBy: vi.fn(), count: vi.fn() }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { driverProfile: { findMany: db.findMany, findUnique: db.findUnique }, orderAssignment: { groupBy: db.groupBy, count: db.count } } }));
import { computeDriverEligibility, listEligibleDrivers } from "@/lib/services/driver-eligibility.service";

function driver(overrides = {}) {
  return {
    id: "driver-1", driverCode: "DRV-1", displayName: "Driver", phone: "123", status: "ACTIVE", availability: "AVAILABLE", maxConcurrentAssignments: 1,
    user: { status: "ACTIVE", role: "DRIVER" },
    serviceRegions: [{ deliveryRegionId: "region-1", deliveryRegion: { name: "Gauteng" } }],
    documents: ["ID_DOCUMENT", "LICENSE"].map(documentType => ({ documentType, status: "APPROVED", expiresAt: null })),
    vehicles: [{ id: "vehicle-1", documents: ["REGISTRATION", "LICENCE_DISC", "INSURANCE"].map(documentType => ({ documentType, status: "APPROVED", expiresAt: null })) }],
    ...overrides,
  };
}

describe("admin driver eligibility projection", () => {
  beforeEach(() => { db.groupBy.mockResolvedValue([]); db.count.mockResolvedValue(0); });

  it("counts a ready driver on the board before an order region is selected", async () => {
    db.findMany.mockResolvedValue([driver()]);
    const result = await listEligibleDrivers(null);
    expect(result.available.map(item => item.id)).toEqual(["driver-1"]);
    expect(result.regionMismatch).toEqual([]);
  });

  it("does not offer a full driver even when available and in the right region", async () => {
    db.findMany.mockResolvedValue([driver()]);
    db.groupBy.mockResolvedValue([{ driverProfileId: "driver-1", _count: { id: 1 } }]);
    const result = await listEligibleDrivers("region-1");
    expect([...result.recommended, ...result.available]).toEqual([]);
    expect(result.unavailable[0].warnings).toContain("Driver has reached assignment capacity");
  });

  it("uses the same capacity decision for a single driver", async () => {
    db.findUnique.mockResolvedValue(driver()); db.count.mockResolvedValue(1);
    expect((await computeDriverEligibility("driver-1", "region-1"))?.eligibility).toBe("BUSY");
  });

  it("keeps region-mismatched drivers out of an order's choices", async () => {
    db.findMany.mockResolvedValue([driver()]);
    const result = await listEligibleDrivers("other-region");
    expect(result.regionMismatch).toHaveLength(1);
    expect([...result.recommended, ...result.available]).toEqual([]);
  });

  it("explains missing coverage and compliance without making the driver eligible", async () => {
    db.findMany.mockResolvedValue([driver({ serviceRegions: [], documents: [], vehicles: [] })]);
    const result = await listEligibleDrivers(null);
    expect(result.notEligible[0].warnings).toContain("No delivery regions configured");
    expect(result.notEligible[0].warnings).toContain("NO_COMPLIANT_APPROVED_VEHICLE");
  });

  it("includes inactive profiles for diagnosis instead of silently omitting them", async () => {
    db.findMany.mockResolvedValue([driver({ status: "PENDING_REVIEW" })]);
    const result = await listEligibleDrivers("region-1");
    expect(result.notEligible[0].warnings).toContain("Driver profile is PENDING_REVIEW");
    expect(db.findMany.mock.calls[0][0].where).toBeUndefined();
  });
});
