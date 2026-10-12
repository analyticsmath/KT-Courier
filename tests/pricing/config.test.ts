import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
const database = vi.hoisted(() => ({ findMany: vi.fn() }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { systemSetting: { findMany: database.findMany } } }));
import { getPricingConfiguration } from "@/lib/pricing/config";
function settings(values: Record<string, unknown>) { database.findMany.mockResolvedValue(Object.entries(values).map(([key, value]) => ({ key, value }))); }
beforeEach(() => { vi.clearAllMocks(); });
describe("canonical JSON pricing settings", () => {
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
