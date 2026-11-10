import { describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
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
      } as unknown as Prisma.TransactionClient;

      const prismaModule = await import("@/lib/db/prisma");
      vi.spyOn(prismaModule.prisma, "$transaction").mockImplementation(
        async (cb: (tx: Prisma.TransactionClient) => Promise<unknown>) => cb(mockTx),
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
      } as unknown as Prisma.TransactionClient;

      const prismaModule = await import("@/lib/db/prisma");
      vi.spyOn(prismaModule.prisma, "$transaction").mockImplementation(
        async (cb: (tx: Prisma.TransactionClient) => Promise<unknown>) => cb(mockTx),
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
      } as unknown as Prisma.TransactionClient;

      const prismaModule = await import("@/lib/db/prisma");
      vi.spyOn(prismaModule.prisma, "$transaction").mockImplementation(
        async (cb: (tx: Prisma.TransactionClient) => Promise<unknown>) => cb(mockTx),
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
      const prismaModule = await import("@/lib/db/prisma");
      vi.spyOn(prismaModule.prisma.user, "findUnique").mockResolvedValue({
        id: "revoked-employee-user",
        status: "ACTIVE",
        role: "CUSTOMER",
      } as never);
      vi.spyOn(prismaModule.prisma.store, "findMany").mockResolvedValue([]);
      vi.spyOn(prismaModule.prisma.storeEmployeeMembership, "findMany").mockResolvedValue([]);

      await expect(storeAccess("revoked-employee-user", "orders")).rejects.toThrow(
        PlatformError,
      );

      await expect(storeAccess("revoked-employee-user", "orders")).rejects.toThrow(
        "You do not have permission to access this business section.",
      );
    });
  });
});
