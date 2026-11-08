import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { requireDisposableStoreSettlementDatabase } from "@/scripts/disposable-store-settlement-guard";
import { updateSettingValue } from "@/lib/services/admin-settings.service";
import { getPricingConfiguration } from "@/lib/pricing/config";

/** This suite runs only against an isolated, locally named disposable database.
 * It tests the real admin writer + pricing reader; production settings and
 * immutable historical quote/order snapshots are never touched.
 */
describe("independent VAT administrative controls and effective pricing", () => {
  let actorId = "";
  const previous = new Map<string, unknown>();
  const keys = [
    "pricing.vat.enabled", "pricing.vat.rate",
    "pricing.marketplace_vat.enabled", "pricing.marketplace_vat.rate",
  ] as const;

  beforeAll(async () => {
    requireDisposableStoreSettlementDatabase();
    const actor = await prisma.user.create({
      data: { email: "vat-test-" + randomUUID() + "@example.test", role: "ADMIN", status: "ACTIVE" },
    });
    actorId = actor.id;
    const rows = await prisma.systemSetting.findMany({ where: { key: { in: [...keys] } } });
    expect(rows.map(row => row.key).sort()).toEqual([...keys].sort());
    rows.forEach(row => previous.set(row.key, row.value));
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

  it("changes only the newly selected commercial domain, then can disable it again", async () => {
    // The parcel switch stays OFF even while a merchant checkout fee is taxable.
    expect("error" in await updateSettingValue(actorId, "pricing.vat.enabled", false)).toBe(false);
    expect("error" in await updateSettingValue(actorId, "pricing.marketplace_vat.enabled", true)).toBe(false);
    expect("error" in await updateSettingValue(actorId, "pricing.marketplace_vat.rate", 0.18)).toBe(false);
    const [parcel, marketplace] = await Promise.all([
      getPricingConfiguration("PARCEL"), getPricingConfiguration("MARKETPLACE"),
    ]);
    expect(parcel.tax.enabled).toBe(false);
    expect(marketplace.tax.enabled).toBe(true);
    expect(marketplace.tax.rate.toFixed(2)).toBe("0.18");
    expect(marketplace.tax.source).toBe("system_setting:pricing.marketplace_vat");

    expect("error" in await updateSettingValue(actorId, "pricing.marketplace_vat.enabled", false)).toBe(false);
    expect((await getPricingConfiguration("MARKETPLACE")).tax.enabled).toBe(false);
    expect((await getPricingConfiguration("PARCEL")).tax.enabled).toBe(false);
  });

  it("refuses malformed rates through the same permission-governed writer", async () => {
    const result = await updateSettingValue(actorId, "pricing.marketplace_vat.rate", 1.25);
    expect(result).toMatchObject({ error: expect.any(String) });
    expect((await getPricingConfiguration("MARKETPLACE")).tax.rate.toFixed(2)).toBe("0.18");
  });
});
