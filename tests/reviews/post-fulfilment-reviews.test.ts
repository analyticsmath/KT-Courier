import { describe, expect, it, vi } from "vitest";
import { submitDeliveryReview, submitDriverReview } from "@/lib/client-platform/reviews.service";
import { PlatformError } from "@/lib/client-platform/contracts";
import { storeAccess } from "@/lib/client-platform/store-access";
import { membershipAllows } from "@/lib/client-platform/store-permissions";

describe("Workstream 5: Post-Fulfilment Reviews & Store Employee RBAC", () => {
  describe("Post-Fulfilment Review Gates", () => {
    it("rejects delivery reviews for uncompleted orders (e.g. IN_TRANSIT)", async () => {
      const mockTx = {
        order: {
          findFirst: vi.fn().mockResolvedValue(null), // because status: { in: ["DELIVERED", "COMPLETED"] }
        },
      } as any;

      const prismaModule = await import("@/lib/db/prisma");
      vi.spyOn(prismaModule.prisma, "$transaction").mockImplementation(async (cb: any) =>
        cb(mockTx),
      );

      await expect(
        submitDeliveryReview("cust-1", {
          orderId: "cjld2cjxh0000qzrmn831i7rn",
          rating: 5,
          body: "Great delivery experience!",
        }),
      ).rejects.toThrow(PlatformError);

      await expect(
        submitDeliveryReview("cust-1", {
          orderId: "cjld2cjxh0000qzrmn831i7rn",
          rating: 5,
          body: "Great delivery experience!",
        }),
      ).rejects.toThrow("You can review your completed deliveries.");
    });

    it("accepts delivery review when order is DELIVERED or COMPLETED", async () => {
      const mockTx = {
        order: {
          findFirst: vi.fn().mockResolvedValue({
            id: "cjld2cjxh0000qzrmn831i7rn",
            storeId: "store-1",
          }),
        },
        deliveryReview: {
          create: vi.fn().mockResolvedValue({
            id: "rev-1",
            rating: 5,
            body: "Great delivery experience!",
            createdAt: new Date(),
          }),
        },
      } as any;

      const prismaModule = await import("@/lib/db/prisma");
      vi.spyOn(prismaModule.prisma, "$transaction").mockImplementation(async (cb: any) =>
        cb(mockTx),
      );

      const result = await submitDeliveryReview("cust-1", {
        orderId: "cjld2cjxh0000qzrmn831i7rn",
        rating: 5,
        body: "Great delivery experience!",
      });

      expect(result.id).toBe("rev-1");
      expect(result.rating).toBe(5);
    });

    it("accepts driver review for completed delivery with assigned driver", async () => {
      const mockTx = {
        order: {
          findFirst: vi.fn().mockResolvedValue({
            id: "cjld2cjxh0000qzrmn831i7rn",
            currentDriverProfileId: "driver-profile-1",
          }),
        },
        driverReview: {
          create: vi.fn().mockResolvedValue({
            id: "drev-1",
            rating: 5,
            body: "Driver was punctual and polite!",
            createdAt: new Date(),
          }),
        },
      } as any;

      const prismaModule = await import("@/lib/db/prisma");
      vi.spyOn(prismaModule.prisma, "$transaction").mockImplementation(async (cb: any) =>
        cb(mockTx),
      );

      const result = await submitDriverReview("cust-1", {
        orderId: "cjld2cjxh0000qzrmn831i7rn",
        rating: 5,
        body: "Driver was punctual and polite!",
      });

      expect(result.id).toBe("drev-1");
      expect(result.rating).toBe(5);
    });
  });

  describe("Store Employee RBAC & Immediate Revocation", () => {
    it("allows operations module when employee has 'orders' permission", () => {
      expect(membershipAllows(["orders", "deliveries"], "orders")).toBe(true);
      expect(membershipAllows(["orders", "deliveries"], "finance")).toBe(false);
    });

    it("denies access immediately when employee membership is inactive or revoked", async () => {
      const mockDb = {
        user: {
          findUnique: vi.fn().mockResolvedValue({ status: "ACTIVE", role: "CUSTOMER" }),
        },
        store: {
          findMany: vi.fn().mockResolvedValue([]), // not an owner
        },
        storeEmployeeMembership: {
          findMany: vi.fn().mockResolvedValue([]), // no active membership
        },
      } as any;

      const prismaModule = await import("@/lib/db/prisma");
      vi.spyOn(prismaModule.prisma.user, "findUnique").mockImplementation(mockDb.user.findUnique);
      vi.spyOn(prismaModule.prisma.store, "findMany").mockImplementation(mockDb.store.findMany);
      vi.spyOn(prismaModule.prisma.storeEmployeeMembership, "findMany").mockImplementation(
        mockDb.storeEmployeeMembership.findMany,
      );

      await expect(storeAccess("revoked-employee-user", "orders")).rejects.toThrow(
        PlatformError,
      );

      await expect(storeAccess("revoked-employee-user", "orders")).rejects.toThrow(
        "You do not have permission to access this business section.",
      );
    });
  });
});
