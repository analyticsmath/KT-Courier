import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { RequestDeliveryOtpSchema } from "@/lib/validation/delivery";
import { CompletePickupSchema } from "@/lib/validation/pickup";
import { resolvePickupOtpSender } from "@/lib/services/delivery-recipient.service";

describe("sender-verified parcel pickup", () => {
  const command = { operationId: "22ecfaab-08cd-41c1-81fb-42cf76e67698", assignmentVersion: 1 };
  it("keeps sender and recipient OTP stages distinct", () => {
    expect(RequestDeliveryOtpSchema.safeParse({ ...command, stage: "PICKUP" }).success).toBe(true);
    expect(RequestDeliveryOtpSchema.safeParse(command).success).toBe(true);
    expect(RequestDeliveryOtpSchema.safeParse({ ...command, stage: "BOTH" }).success).toBe(false);
    expect(CompletePickupSchema.safeParse({ ...command, confirmPickup: true, pickupOtpCode: "123456" }).success).toBe(true);
    expect(CompletePickupSchema.safeParse({ ...command, confirmPickup: true, pickupOtpCode: "12345X" }).success).toBe(false);
  });

  const row = { id: "order", status: "PICKUP_SCHEDULED", customerId: "sender",
    customer: { id: "sender", email: "sender@example.test", name: "Sender", status: "ACTIVE", emailVerifiedAt: new Date() } };
  it("routes pickup exclusively to the verified booking sender", async () => {
    const db = {
      order: { findUnique: vi.fn().mockResolvedValue(row) },
      marketplaceStoreOrderDeliveryBridge: { findUnique: vi.fn().mockResolvedValue(null) },
    };
    const recipient = await resolvePickupOtpSender("order", db as never);
    expect(recipient).toMatchObject({ kind: "ACCOUNT", subjectUserId: "sender", email: "sender@example.test" });
  });

  it("does not send pickup codes to unverified, missing or marketplace identities", async () => {
    const db = {
      order: { findUnique: vi.fn() },
      marketplaceStoreOrderDeliveryBridge: { findUnique: vi.fn().mockResolvedValue(null) },
    };
    db.order.findUnique.mockResolvedValue({ ...row, customer: { ...row.customer, emailVerifiedAt: null } });
    await expect(resolvePickupOtpSender("order", db as never)).rejects.toThrow();
    db.order.findUnique.mockResolvedValue(row);
    db.marketplaceStoreOrderDeliveryBridge.findUnique.mockResolvedValue({ id: "marketplace" });
    await expect(resolvePickupOtpSender("order", db as never)).rejects.toThrow();
  });

  it("retains an explicit pickup enforcement gate for in-flight rollout", () => {
    const service = readFileSync(new URL("../../lib/services/pickup-custody.service.ts", import.meta.url), "utf8");
    const ui = readFileSync(new URL("../../app/(driver)/driver/assignments/[id]/page.tsx", import.meta.url), "utf8");
    expect(service).toContain('PICKUP_SENDER_OTP_REQUIRED === "true"');
    expect(service).toContain('verifyDeliveryOtpInTx(tx, order.id, input.pickupOtpCode!, assignmentId)');
    expect(ui).toContain("Email pickup code to sender");
  });
});
