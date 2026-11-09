import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { updateSettingValue } from "@/lib/services/admin-settings.service";
import { requireDisposableStoreSettlementDatabase } from "@/scripts/disposable-store-settlement-guard";
import {
  evaluateLocalityCashRisk, parseHighRiskAreas,
} from "@/lib/settings/high-risk-area-policy";

describe("audited admin-configurable high-risk suburb policy", () => {
  const key = "delivery.high_risk_areas";
  let actor = "";
  let original: unknown = null;

  beforeAll(async () => {
    requireDisposableStoreSettlementDatabase();
    const user = await prisma.user.create({
      data: { email: "high-risk-admin-" + randomUUID() + "@example.test", role: "ADMIN", status: "ACTIVE" },
    });
    actor = user.id;
    const stored = await prisma.systemSetting.findUniqueOrThrow({ where: { key } });
    original = stored.value;
    expect(stored.type).toBe("JSON");
  });

  afterAll(async () => {
    if (!actor) return;
    await prisma.systemSetting.update({ where: { key }, data: { value: original as never } });
    await prisma.adminActivityLog.deleteMany({ where: { actorUserId: actor } });
    await prisma.user.delete({ where: { id: actor } });
    await prisma.$disconnect();
  });

  it("admin can add risk context and disable a specific area without disabling all Johannesburg cash", async () => {
    const previous = parseHighRiskAreas(original);
    expect(previous).not.toBeNull();
    expect(previous?.length).toBe(42);
    const changed = previous!.map(area => area.id === "jhb-hillbrow"
      ? { ...area, notes: "Digital-only pending local route security review.", active: false }
      : area);
    expect("error" in await updateSettingValue(actor, key, changed)).toBe(false);
    const saved = parseHighRiskAreas((await prisma.systemSetting.findUniqueOrThrow({ where: { key } })).value);
    expect(saved?.find(area => area.id === "jhb-hillbrow")).toMatchObject({
      active: false, notes: "Digital-only pending local route security review.",
    });
    const location = { city: "Johannesburg", suburb: "Hillbrow", province: "Gauteng" };
    const safe = { city: "Johannesburg", suburb: "Rosebank", province: "Gauteng" };
    expect(evaluateLocalityCashRisk(location, safe, saved!)).toMatchObject({ restrictCash: false });
    expect(evaluateLocalityCashRisk({ ...location, suburb: "Yeoville" }, safe, saved!)).toMatchObject({ restrictCash: true });
    expect(await prisma.adminActivityLog.count({
      where: { actorUserId: actor, entityType: "SystemSetting" },
    })).toBe(1);
    const invalid = changed.map(area => area.id === "jhb-hillbrow"
      ? { ...area, notes: "duplicate" }
      : area).concat(changed[0]);
    expect(await updateSettingValue(actor, key, invalid)).toMatchObject({ error: expect.any(String) });
  });
});
