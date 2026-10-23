import { describe, expect, it, vi, beforeEach } from "vitest";
const db = vi.hoisted(() => ({ receipt: vi.fn() }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { driverOperationCommand: { findFirst: db.receipt } } }));
import { isIssuedOtpForStage } from "@/lib/driver-operations/otp-stage-authority";

describe("pickup and delivery OTP custody boundaries", () => {
  beforeEach(() => vi.resetAllMocks());
  const check = (stage: "PICKUP" | "DELIVERY", row: object | null) => {
    db.receipt.mockResolvedValueOnce(row);
    return isIssuedOtpForStage("parcel-order", "otp-one", "assignment-one", stage);
  };
  it("accepts only the receipt that issued the OTP for this custody stage", async () => {
    expect(await check("DELIVERY", { id: "delivery-receipt" })).toBe(true);
    expect(db.receipt.mock.calls[0][0].where).toMatchObject({
      orderId: "parcel-order", assignmentId: "assignment-one",
      type: "DELIVERY_OTP_REQUEST",
      resultSnapshot: { path: ["createdOtpId"], equals: "otp-one" },
    });
    expect(await check("PICKUP", { id: "pickup-receipt" })).toBe(true);
    expect(db.receipt.mock.calls[1][0].where.type).toBe("PICKUP_OTP_REQUEST");
  });
  it("rejects cross-stage reuse, missing assignment and unknown receipts", async () => {
    expect(await check("DELIVERY", null)).toBe(false);
    expect(await isIssuedOtpForStage("parcel-order", "otp-one", null, "PICKUP")).toBe(false);
    expect(db.receipt).toHaveBeenCalledTimes(1);
  });
  it("does not trust an incomplete command receipt", async () => {
    expect(await check("PICKUP", null)).toBe(false);
    expect(db.receipt.mock.calls[0][0].where.completedAt).toEqual({ not: null });
  });
});
