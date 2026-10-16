import { describe, expect, it, vi, beforeEach } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  driverProfile: {
    findUnique: vi.fn(),
  },
  deliveryRegion: {
    findMany: vi.fn(),
  },
  driverServiceRegion: {
    deleteMany: vi.fn(),
    createMany: vi.fn(),
    findMany: vi.fn(),
  },
  $transaction: vi.fn((callback) => callback(mockPrisma)),
}));

vi.mock("@/lib/db/prisma", () => ({ prisma: mockPrisma }));

import { getOwnDriverRegions, updateOwnDriverRegions } from "@/lib/services/driver-profile.service";

describe("driver self-service regions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getOwnDriverRegions", () => {
    it("returns all active regions and currently assigned regions for the driver", async () => {
      mockPrisma.driverProfile.findUnique.mockResolvedValueOnce({
        id: "drv-1",
        serviceRegions: [
          {
            deliveryRegionId: "reg-jhb",
            isPrimary: true,
            deliveryRegion: { id: "reg-jhb", name: "Johannesburg", slug: "jhb" },
          },
        ],
      });

      mockPrisma.deliveryRegion.findMany.mockResolvedValueOnce([
        { id: "reg-jhb", name: "Johannesburg", slug: "jhb", city: "Johannesburg", province: "Gauteng" },
        { id: "reg-pta", name: "Pretoria", slug: "pta", city: "Pretoria", province: "Gauteng" },
      ]);

      const result = await getOwnDriverRegions("user-1");

      expect(result.allRegions).toHaveLength(2);
      expect(result.assignedRegions).toHaveLength(1);
      expect(result.assignedRegions[0].regionId).toBe("reg-jhb");
      expect(result.assignedRegions[0].isPrimary).toBe(true);
      expect(result.primaryRegionId).toBe("reg-jhb");
    });

    it("throws if driver profile not found", async () => {
      mockPrisma.driverProfile.findUnique.mockResolvedValueOnce(null);
      await expect(getOwnDriverRegions("unknown-user")).rejects.toThrow("Driver profile not found.");
    });
  });

  describe("updateOwnDriverRegions", () => {
    it("updates driver service regions in transaction and resolves primary region", async () => {
      mockPrisma.driverProfile.findUnique.mockResolvedValueOnce({ id: "drv-1" });
      mockPrisma.deliveryRegion.findMany.mockResolvedValueOnce([
        { id: "reg-jhb" },
        { id: "reg-pta" },
      ]);
      mockPrisma.driverServiceRegion.deleteMany.mockResolvedValueOnce({ count: 1 });
      mockPrisma.driverServiceRegion.createMany.mockResolvedValueOnce({ count: 2 });
      mockPrisma.driverServiceRegion.findMany.mockResolvedValueOnce([
        {
          deliveryRegionId: "reg-jhb",
          isPrimary: true,
          deliveryRegion: { id: "reg-jhb", name: "Johannesburg", slug: "jhb" },
        },
        {
          deliveryRegionId: "reg-pta",
          isPrimary: false,
          deliveryRegion: { id: "reg-pta", name: "Pretoria", slug: "pta" },
        },
      ]);

      const result = await updateOwnDriverRegions("user-1", ["reg-jhb", "reg-pta"], "reg-jhb");

      expect(mockPrisma.driverServiceRegion.deleteMany).toHaveBeenCalledWith({
        where: { driverProfileId: "drv-1" },
      });
      expect(mockPrisma.driverServiceRegion.createMany).toHaveBeenCalledWith({
        data: [
          { driverProfileId: "drv-1", deliveryRegionId: "reg-jhb", isPrimary: true },
          { driverProfileId: "drv-1", deliveryRegionId: "reg-pta", isPrimary: false },
        ],
      });
      expect(result.assignedRegions).toHaveLength(2);
      expect(result.primaryRegionId).toBe("reg-jhb");
    });

    it("rejects if one of the selected regions is invalid or inactive", async () => {
      mockPrisma.driverProfile.findUnique.mockResolvedValueOnce({ id: "drv-1" });
      // Only 1 region returned as valid/active out of 2 requested
      mockPrisma.deliveryRegion.findMany.mockResolvedValueOnce([{ id: "reg-jhb" }]);

      await expect(
        updateOwnDriverRegions("user-1", ["reg-jhb", "reg-nonexistent"], "reg-jhb")
      ).rejects.toThrow("One or more selected delivery regions are invalid or inactive.");
    });
  });
});
