import { describe, expect, it, vi } from "vitest";
import type { Prisma } from "@prisma/client";
import { requireVerifiedDeliveryLocationInTx } from "@/lib/services/driver-location-evidence.service";

describe("delivery completion location policy", () => {
  it("fails closed when no fresh verified device evidence exists", async () => {
    const tx: Pick<Prisma.TransactionClient, "$queryRaw"> = { $queryRaw: vi.fn().mockResolvedValue([]) };
    await expect(requireVerifiedDeliveryLocationInTx(tx, {
      orderId: "order-1",
      assignmentId: "assignment-1",
      driverProfileId: "driver-1",
    })).rejects.toMatchObject({ code: "DRIVER_OPERATION_INVALID_STATE" });
  });
});
