import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
const database = vi.hoisted(() => ({ findMany: vi.fn() }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { systemSetting: { findMany: database.findMany } } }));
import { getPricingConfiguration } from "@/lib/pricing/config";
import { SYSTEM_SETTING_CATALOG } from "@/lib/settings/catalog";
function settings(values: Record<string, unknown>) { database.findMany.mockResolvedValue(Object.entries(values).map(([key, value]) => ({ key, value }))); }
beforeEach(() => { vi.clearAllMocks(); });
describe("canonical JSON pricing settings", () => {
  it("defaults parcel VAT off and exposes an editable numeric rate", () => {
    expect(SYSTEM_SETTING_CATALOG["pricing.vat.enabled"].safeDefault).toBe(false);
    expect(SYSTEM_SETTING_CATALOG["pricing.vat.rate"].type).toBe("NUMBER");
    expect(SYSTEM_SETTING_CATALOG["pricing.vat.rate"].safeDefault).toBe(0.15);
  });
  it.each([[true, 0.15, 20], ["true", "0.1500", "20"]])("reads current JSON values and legacy string values", async (enabled, rate, ttl) => {
    settings({ "pricing.vat.enabled": enabled, "pricing.vat.rate": rate, "pricing.quote_ttl_minutes": ttl });
    const config = await getPricingConfiguration();
    expect(config.tax.enabled).toBe(true); expect(config.tax.rate.toFixed(4)).toBe("0.1500"); expect(config.quoteTtlMinutes).toBe(20);
    expect(new Prisma.Decimal("23.45").mul(config.tax.rate).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP).toFixed(2)).toBe("3.52");
  });
  it.each([false, "false"])("honors explicitly disabled tax: %s", async (enabled) => {
    settings({ "pricing.vat.enabled": enabled, "pricing.vat.rate": "0.15" });
    expect((await getPricingConfiguration()).tax.enabled).toBe(false);
  });
  it("keeps parcel and marketplace VAT controls independent and both off by default", async () => {
    expect(SYSTEM_SETTING_CATALOG["pricing.vat.enabled"].safeDefault).toBe(false);
    expect(SYSTEM_SETTING_CATALOG["pricing.marketplace_vat.enabled"].safeDefault).toBe(false);
    expect(SYSTEM_SETTING_CATALOG["pricing.marketplace_vat.rate"].type).toBe("NUMBER");
    settings({
      "pricing.vat.enabled": true, "pricing.vat.rate": "0.15",
      "pricing.marketplace_vat.enabled": false, "pricing.marketplace_vat.rate": "0.20",
    });
    const parcel = await getPricingConfiguration();
    const market = await getPricingConfiguration("MARKETPLACE");
    expect(parcel.tax).toMatchObject({ enabled: true, source: "system_setting:pricing.vat" });
    expect(parcel.tax.rate.toFixed(2)).toBe("0.15");
    expect(market.tax).toMatchObject({ enabled: false, source: "system_setting:pricing.marketplace_vat" });
    expect(market.tax.rate.toFixed(2)).toBe("0.20");
    expect(new Prisma.Decimal("100.00").mul(market.tax.enabled ? market.tax.rate : 0).toFixed(2)).toBe("0.00");
  });
  it("never inherits enabled parcel VAT when marketplace settings have not been configured", async () => {
    settings({ "pricing.vat.enabled": true, "pricing.vat.rate": "0.15" });
    const marketplace = await getPricingConfiguration("MARKETPLACE");
    expect(marketplace.tax.enabled).toBe(false);
    expect(marketplace.tax.rate.toString()).toBe("0");
    expect(marketplace.tax.source).toBe("system_setting:pricing.marketplace_vat");
  });
  it("allows marketplace delivery VAT without activating parcel VAT", async () => {
    settings({ "pricing.vat.enabled": false, "pricing.marketplace_vat.enabled": true, "pricing.marketplace_vat.rate": "0.15" });
    expect((await getPricingConfiguration()).tax.enabled).toBe(false);
    expect((await getPricingConfiguration("MARKETPLACE")).tax.enabled).toBe(true);
  });
  it.each([
    { "pricing.marketplace_vat.enabled": true },
    { "pricing.marketplace_vat.enabled": "yes" },
    { "pricing.marketplace_vat.enabled": true, "pricing.marketplace_vat.rate": "1.3" },
    { "pricing.marketplace_vat.rate": "invalid" },
  ])("fails closed on invalid marketplace VAT configuration %j", async values => {
    settings(values);
    await expect(getPricingConfiguration("MARKETPLACE")).rejects.toMatchObject({ code: "PRICING_CONFIGURATION_INVALID" });
  });
  it("keeps absent tax disabled and does not invent an active rate", async () => {
    settings({}); const config = await getPricingConfiguration();
    expect(config.tax.enabled).toBe(false); expect(config.tax.rate.toString()).toBe("0"); expect(config.quoteTtlMinutes).toBe(15);
  });
  const invalid: Record<string, unknown>[] = [
    { "pricing.vat.enabled": 1 }, { "pricing.vat.enabled": "yes" }, { "pricing.vat.enabled": {} },
    { "pricing.vat.enabled": true }, { "pricing.vat.enabled": true, "pricing.vat.rate": -0.15 },
    { "pricing.vat.rate": "NaN" }, { "pricing.vat.rate": "1.5" }, { "pricing.vat.rate": "0.12345" },
    { "pricing.vat.rate": {} }, { "pricing.quote_ttl_minutes": "20junk" }, { "pricing.quote_ttl_minutes": 0 },
    { "pricing.quote_ttl_minutes": 121 }, { "pricing.quote_ttl_minutes": true },
    { "pricing.vat.enabled": null }, { "pricing.quote_ttl_minutes": null },
  ];
  it.each(invalid)("fails closed on malformed or incomplete settings: %j", async (values) => {
    settings(values); await expect(getPricingConfiguration()).rejects.toMatchObject({ code: "PRICING_CONFIGURATION_INVALID", status: 503 });
  });
});
