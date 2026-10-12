import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ActiveParcelProfile } from "@/lib/commercial/configuration.service";
const mocks = vi.hoisted(() => ({ active: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), updateMany: vi.fn(), create: vi.fn(), audit: vi.fn(), lock: vi.fn() }));
vi.mock("@/lib/commercial/configuration.service", () => ({ getActiveParcelProfiles: mocks.active }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { $transaction: async (callback: (tx: unknown) => unknown) => callback({ $executeRaw: mocks.lock, parcelProfileVersion: { findFirst: mocks.findFirst, findMany: mocks.findMany, updateMany: mocks.updateMany, create: mocks.create }, adminActivityLog: { create: mocks.audit } }) } }));
import { requireParcelProfile, saveParcelProfile, usableParcelProfiles } from "@/lib/commercial/parcel-profiles";

function profile(stableKey = "SMALL", versionNumber = 1): ActiveParcelProfile {
  return { id: `${stableKey}-${versionNumber}`, stableKey, versionNumber, displayName: stableKey, lengthCm: new Prisma.Decimal(20), widthCm: new Prisma.Decimal(15), heightCm: new Prisma.Decimal(10), maximumWeightKg: new Prisma.Decimal(5), sortOrder: 0 };
}
beforeEach(() => { vi.resetAllMocks(); mocks.active.mockResolvedValue([profile()]); });
describe("parcel acceptance configuration", () => {
  it("blocks an ambiguous size even if one effective version has valid limits", () => {
    expect(usableParcelProfiles([profile(), profile("SMALL", 2), profile("MEDIUM")]).map((p) => p.stableKey)).toEqual(["MEDIUM"]);
  });
  it.each([null, new Prisma.Decimal(0), new Prisma.Decimal(-1), new Prisma.Decimal("Infinity"), new Prisma.Decimal(1001)])("rejects missing, invalid or out-of-range dimensions (%s)", (lengthCm) => {
    expect(usableParcelProfiles([{ ...profile(), lengthCm }])).toEqual([]);
  });
  it("never exposes an unknown parcel class", () => {
    expect(usableParcelProfiles([profile("UNAPPROVED")])).toEqual([]);
  });
  it.each(["NaN", "Infinity", "0", "-1", "5.001", ""])("rejects invalid or overweight input before acceptance (%s)", async (weight) => {
    await expect(requireParcelProfile("SMALL", weight)).rejects.toMatchObject({ code: "WEIGHT_UNSUPPORTED", status: 422 });
  });
  it("accepts the exact published weight limit and snapshots its version", async () => {
    expect(await requireParcelProfile("SMALL", "5.000")).toMatchObject({ id: "SMALL-1", versionNumber: 1, maximumWeightKg: 5 });
  });
  it("refuses to truncate an existing future active version into a negative interval", async () => {
    mocks.findFirst.mockResolvedValue({ versionNumber: 2 });
    mocks.findMany.mockResolvedValue([{ effectiveFrom: new Date("2026-11-01T00:00:00Z") }]);
    await expect(saveParcelProfile("real-author", { stableKey: "SMALL", displayName: "Small", lengthCm: 20, widthCm: 15, heightCm: 10, maximumWeightKg: 5, status: "ACTIVE", effectiveFrom: "2026-10-31T00:00:00Z", effectiveTo: null, expectedVersion: 2, reason: "Review effective version conflict" })).rejects.toMatchObject({ code: "EFFECTIVE_DATE_CONFLICT", status: 409 });
    expect(mocks.updateMany).not.toHaveBeenCalled(); expect(mocks.create).not.toHaveBeenCalled(); expect(mocks.audit).not.toHaveBeenCalled();
  });
});
