import { describe, expect, it, vi, beforeEach } from "vitest";
import { PrivateMediaOwnerType, PrivateMediaPurpose, VehicleMediaPurpose, VehicleType } from "@/types/db";

const mockPrisma = vi.hoisted(() => ({
  driverProfile: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  user: {
    update: vi.fn(),
  },
  privateMediaObject: {
    findUnique: vi.fn(),
  },
  vehicle: {
    findFirst: vi.fn(),
    create: vi.fn(),
  },
  vehicleMedia: {
    upsert: vi.fn(),
  },
}));

vi.mock("@/lib/db/prisma", () => ({ prisma: mockPrisma }));

import {
  attachOwnProfilePhoto,
  completeDriverOnboarding,
} from "@/lib/services/driver-profile.service";
import {
  attachOwnVehicleMedia,
  createOwnVehicle,
  VehicleComplianceError,
} from "@/lib/services/vehicle-compliance.service";

describe("Phase 1 Acceptance: Structured Driver Identity & Vehicle Media Attachment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Driver Profile Photo Attachment", () => {
    it("attaches profile photo when private media is valid, ready, and owned by driver", async () => {
      mockPrisma.driverProfile.findUnique.mockResolvedValueOnce({
        id: "driver-uuid-1",
        userId: "user-driver-1",
      });

      mockPrisma.privateMediaObject.findUnique.mockResolvedValueOnce({
        id: "media-uuid-photo",
        publicReference: "MED-PHOTO-1",
        ownerType: PrivateMediaOwnerType.DRIVER,
        ownerId: "driver-uuid-1",
        status: "READY",
        purpose: PrivateMediaPurpose.DRIVER_PROFILE_PHOTO,
      });

      mockPrisma.driverProfile.update.mockResolvedValueOnce({
        id: "driver-uuid-1",
        userId: "user-driver-1",
        profilePhotoMediaId: "media-uuid-photo",
        driverCode: "DRV-1",
        displayName: "Sipho D",
        phone: "+27821112233",
        status: "ACTIVE",
        availability: "OFFLINE",
        onboardingStatus: "APPROVED",
        user: { email: "sipho@example.com", name: "Sipho D" },
        serviceRegions: [],
      });

      const result = await attachOwnProfilePhoto({
        driverUserId: "user-driver-1",
        privateMediaReference: "MED-PHOTO-1",
      });

      expect(mockPrisma.driverProfile.update).toHaveBeenCalledWith({
        where: { id: "driver-uuid-1" },
        data: { profilePhotoMediaId: "media-uuid-photo" },
        include: expect.any(Object),
      });
      expect(result).toBeDefined();
    });

    it("fails closed when media belongs to a different owner or has wrong purpose", async () => {
      mockPrisma.driverProfile.findUnique.mockResolvedValueOnce({
        id: "driver-uuid-1",
        userId: "user-driver-1",
      });

      // Media owned by someone else
      mockPrisma.privateMediaObject.findUnique.mockResolvedValueOnce({
        id: "media-uuid-wrong",
        publicReference: "MED-OTHER",
        ownerType: PrivateMediaOwnerType.DRIVER,
        ownerId: "other-driver-uuid",
        status: "READY",
        purpose: PrivateMediaPurpose.DRIVER_PROFILE_PHOTO,
      });

      await expect(
        attachOwnProfilePhoto({
          driverUserId: "user-driver-1",
          privateMediaReference: "MED-OTHER",
        }),
      ).rejects.toThrow(/cannot be used as a driver profile photo/i);
    });
  });

  describe("Structured Driver Identity Persistence", () => {
    it("persists typed identity fields in completeDriverOnboarding", async () => {
      mockPrisma.driverProfile.findUnique.mockResolvedValueOnce({
        id: "driver-uuid-1",
        userId: "user-driver-1",
        displayName: "Sipho",
      });

      mockPrisma.driverProfile.update.mockResolvedValueOnce({
        id: "driver-uuid-1",
        userId: "user-driver-1",
        driverCode: "DRV-1",
        displayName: "Sipho D",
        phone: "+27821112233",
        status: "PENDING_REVIEW",
        availability: "OFFLINE",
        onboardingStatus: "PENDING_REVIEW",
        idNumber: "9001015009087",
        idType: "RSA_ID",
        dateOfBirth: new Date("1990-01-01T00:00:00.000Z"),
        residentialAddress: "42 Long St, Cape Town",
        user: { email: "sipho@example.com", name: "Sipho D" },
        serviceRegions: [],
      });

      mockPrisma.user.update.mockResolvedValueOnce({});

      await completeDriverOnboarding("user-driver-1", {
        displayName: "Sipho D",
        phone: "+27821112233",
        licenseNumber: "LIC-12345",
        licenseExpiryDate: new Date("2028-01-01T00:00:00.000Z"),
        emergencyContactName: "Nomsa D",
        emergencyContactPhone: "+27829998877",
        idNumber: "9001015009087",
        idType: "RSA_ID",
        dateOfBirth: new Date("1990-01-01T00:00:00.000Z"),
        residentialAddress: "42 Long St, Cape Town",
      });

      expect(mockPrisma.driverProfile.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: "user-driver-1" },
          data: expect.objectContaining({
            idNumber: "9001015009087",
            idType: "RSA_ID",
            dateOfBirth: new Date("1990-01-01T00:00:00.000Z"),
            residentialAddress: "42 Long St, Cape Town",
          }),
        }),
      );
    });
  });

  describe("Vehicle Capacity & Vehicle Media Attachment", () => {
    it("collects and persists capacityKg during vehicle creation", async () => {
      mockPrisma.driverProfile.findUnique.mockResolvedValueOnce({
        id: "driver-uuid-1",
      });

      mockPrisma.vehicle.findFirst.mockResolvedValueOnce(null); // No collision

      mockPrisma.vehicle.create.mockResolvedValueOnce({
        id: "veh-uuid-1",
        publicReference: "VEH-1",
        registrationNumber: "CA123456",
        vehicleType: VehicleType.MOTORBIKE,
        capacityKg: "45.00",
        status: "PENDING",
        createdAt: new Date(),
      });

      const vehicle = await createOwnVehicle("user-driver-1", {
        make: "Honda",
        model: "Ace 125",
        year: 2023,
        colour: "Red",
        registrationNumber: "CA 123 456",
        vehicleType: VehicleType.MOTORBIKE,
        capacityKg: "45.00",
      });

      expect(mockPrisma.vehicle.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          make: "Honda",
          model: "Ace 125",
          registrationNumber: "CA123456",
          vehicleType: VehicleType.MOTORBIKE,
          capacityKg: "45.00",
        }),
        select: expect.any(Object),
      });
      expect(vehicle.registrationNumber).toBe("CA123456");
    });

    it("attaches vehicle photos (FRONT, SIDE) via attachOwnVehicleMedia", async () => {
      mockPrisma.vehicle.findFirst.mockResolvedValueOnce({ id: "veh-uuid-1" });
      mockPrisma.privateMediaObject.findUnique.mockResolvedValueOnce({
        id: "media-uuid-front",
        ownerType: PrivateMediaOwnerType.VEHICLE,
        ownerId: "veh-uuid-1",
        status: "READY",
        purpose: PrivateMediaPurpose.VEHICLE_COMPLIANCE_IMAGE,
      });

      mockPrisma.vehicleMedia.upsert.mockResolvedValueOnce({
        id: "vm-1",
        vehicleId: "veh-uuid-1",
        purpose: VehicleMediaPurpose.FRONT,
        privateMediaObjectId: "media-uuid-front",
      });

      const result = await attachOwnVehicleMedia({
        driverUserId: "user-driver-1",
        vehicleId: "veh-uuid-1",
        purpose: VehicleMediaPurpose.FRONT,
        privateMediaReference: "MED-FRONT-1",
      });

      expect(mockPrisma.vehicleMedia.upsert).toHaveBeenCalledWith({
        where: { vehicleId_purpose: { vehicleId: "veh-uuid-1", purpose: VehicleMediaPurpose.FRONT } },
        update: { privateMediaObjectId: "media-uuid-front" },
        create: { vehicleId: "veh-uuid-1", purpose: VehicleMediaPurpose.FRONT, privateMediaObjectId: "media-uuid-front" },
      });
      expect(result).toBeDefined();
    });

    it("fails closed when driver tries to attach media to a vehicle they do not own", async () => {
      mockPrisma.vehicle.findFirst.mockResolvedValueOnce(null); // Vehicle not owned by driver

      await expect(
        attachOwnVehicleMedia({
          driverUserId: "user-driver-attacker",
          vehicleId: "veh-uuid-someone-else",
          purpose: VehicleMediaPurpose.SIDE,
          privateMediaReference: "MED-SIDE-1",
        }),
      ).rejects.toThrow(VehicleComplianceError);
    });
  });
});
