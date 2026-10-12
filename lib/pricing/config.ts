import { prisma } from "@/lib/db/prisma";
import { Decimal } from "./money";
import { PricingError } from "./errors";

export const PRICING_CALCULATION_VERSION = "pricing-engine-v1";

export async function getPricingConfiguration() {
  const settings = await prisma.systemSetting.findMany({ where: { key: { in: ["pricing.vat.enabled", "pricing.vat.rate", "pricing.quote_ttl_minutes"] } } });
  const value = (key: string) => settings.find((setting) => setting.key === key)?.value;
  const invalid = (): never => { throw new PricingError("PRICING_CONFIGURATION_INVALID", "Pricing tax and expiry settings require valid configuration.", 503); };
  const rawEnabled = value("pricing.vat.enabled");
  const enabledValue = rawEnabled === undefined ? false : rawEnabled;
  if (enabledValue !== true && enabledValue !== false && enabledValue !== "true" && enabledValue !== "false") invalid();
  const enabled = enabledValue === true || enabledValue === "true";
  const rawRate = value("pricing.vat.rate");
  if (enabled && rawRate == null) invalid();
  const rateValue = rawRate ?? "0";
  if (!["string", "number"].includes(typeof rateValue) || !/^(?:0(?:\.[0-9]{1,4})?|1(?:\.0{1,4})?)$/.test(String(rateValue))) invalid();
  const storedTtl = value("pricing.quote_ttl_minutes");
  const rawTtl = storedTtl === undefined ? "15" : storedTtl;
  if (!["string", "number"].includes(typeof rawTtl) || !/^\d+$/.test(String(rawTtl))) invalid();
  const ttl = Number(rawTtl);
  if (!Number.isSafeInteger(ttl) || ttl < 1 || ttl > 120) invalid();
  return {
    tax: { enabled, rate: new Decimal(String(rateValue)), source: "system_setting:pricing.vat" },
    quoteTtlMinutes: ttl,
  };
}
