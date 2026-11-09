import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { requireDisposableStoreSettlementDatabase } from "@/scripts/disposable-store-settlement-guard";
import { updateSettingValue } from "@/lib/services/admin-settings.service";
import { loadCustomerRewardPolicy } from "@/lib/rewards/customer-reward-configuration";
import { DEFAULT_CUSTOMER_REWARD_POLICY, firstStoreWelcomeDiscount } from "@/lib/rewards/customer-reward-policy";

describe("Phase 3 reward settings are editable, validated and applied to eligibility", () => {
  const previous = new Map<string, unknown>();
  let actorId = "";
  const keys = [
    "loyalty.points_per_zar", "loyalty.conversion_points", "loyalty.conversion_wallet_zar",
    "referral.reward_zar", "welcome.store.discount_zar", "welcome.store.valid_days",
    "welcome.store.minimum_order_zar",
  ] as const;
  beforeAll(async () => {
    requireDisposableStoreSettlementDatabase();
    const actor = await prisma.user.create({
      data: { email: "reward-settings-" + randomUUID() + "@example.test", role: "ADMIN", status: "ACTIVE" },
    });
    actorId = actor.id;
    const rows = await prisma.systemSetting.findMany({ where: { key: { in: [...keys] } } });
    expect(rows).toHaveLength(keys.length);
    for (const row of rows) previous.set(row.key, row.value);
  });

  afterAll(async () => {
    if (!actorId) return;
    for (const [key, value] of previous) {
      await prisma.systemSetting.update({ where: { key }, data: { value: value as never } });
    }
    await prisma.adminActivityLog.deleteMany({ where: { actorUserId: actorId } });
    await prisma.user.delete({ where: { id: actorId } });
    await prisma.$disconnect();
  });

  it("loads the client's policy, changes rates through the audited admin writer and rejects bad values", async () => {
    for (const [key, value] of [
      ["loyalty.points_per_zar", 1], ["loyalty.conversion_points", 100],
      ["loyalty.conversion_wallet_zar", 2], ["referral.reward_zar", 5],
      ["welcome.store.discount_zar", 50], ["welcome.store.valid_days", 7],
      ["welcome.store.minimum_order_zar", 0],
    ] as const) {
      expect("error" in await updateSettingValue(actorId, key, value)).toBe(false);
    }
    expect(await loadCustomerRewardPolicy()).toEqual(DEFAULT_CUSTOMER_REWARD_POLICY);
    expect(await updateSettingValue(actorId, "welcome.store.discount_zar", "50junk")).toMatchObject({ error: expect.any(String) });
    expect(await updateSettingValue(actorId, "loyalty.points_per_zar", 1.5)).toMatchObject({ error: expect.any(String) });
    expect("error" in await updateSettingValue(actorId, "welcome.store.discount_zar", 65.25)).toBe(false);
    expect("error" in await updateSettingValue(actorId, "welcome.store.minimum_order_zar", 90)).toBe(false);
    expect("error" in await updateSettingValue(actorId, "welcome.store.valid_days", 9)).toBe(false);
    const forbidden = await updateSettingValue("missing-administrator", "referral.reward_zar", 999);
    expect(forbidden).toMatchObject({ error: expect.any(String) });
    expect((await loadCustomerRewardPolicy()).referralRewardZar).toBe("5.00");
    const audited = await prisma.adminActivityLog.findFirstOrThrow({
      where: { actorUserId: actorId, entityType: "SystemSetting" },
      orderBy: { createdAt: "desc" },
    });
    expect(audited.metadata).toMatchObject({
      previousValueDigest: expect.stringMatching(/^[a-f0-9]{64}$/),
      newValueDigest: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
    const edited = await loadCustomerRewardPolicy();
    expect(edited.firstStoreDiscountZar).toBe("65.25");
    expect(edited.firstStoreMinimumZar).toBe("90.00");
    expect(edited.firstStoreValidDays).toBe(9);
    const now = new Date("2026-11-08T00:00:00Z");
    const offer = firstStoreWelcomeDiscount({
      orderType: "MARKETPLACE",
      customerSignupAt: new Date("2026-11-01T00:00:00Z"),
      checkedAt: now,
      successfulStoreOrdersBefore: 0, priorWelcomeOfferRedemptions: 0,
      merchandiseSubtotalZar: "100.00", policy: edited,
    });
    expect(offer).toBe("65.25");
    expect(await prisma.adminActivityLog.count({ where: { actorUserId: actorId, entityType: "SystemSetting" } })).toBeGreaterThanOrEqual(10);
  });
});
