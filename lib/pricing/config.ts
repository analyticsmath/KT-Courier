import { prisma } from "@/lib/db/prisma";
import { Decimal } from "./money";
import { PricingError } from "./errors";

export const PRICING_CALCULATION_VERSION = "pricing-engine-v1";

/** Parcel VAT retains the historical setting key; marketplace delivery VAT has
 * an independent, off-by-default switch. Neither setting retroactively edits
 * immutable pricing/order snapshots or a third-party seller's own VAT treatment.
 */
export type PricingTaxDomain = "PARCEL" | "MARKETPLACE";
export async function getPricingConfiguration(taxDomain: PricingTaxDomain = "PARCEL") {
  const prefix = taxDomain === "MARKETPLACE" ? "pricing.marketplace_vat" : "pricing.vat";
  const enabledKey = prefix + ".enabled";
  const rateKey = prefix + ".rate";
  const settings = await prisma.systemSetting.findMany({ where: { key: { in: [enabledKey, rateKey, "pricing.quote_ttl_minutes"] } } });
  const value = (key: string) => settings.find((setting) => setting.key === key)?.value;
  const invalid = (): never => { throw new PricingError("PRICING_CONFIGURATION_INVALID", "Pricing tax and expiry settings require valid configuration.", 503); };
  const rawEnabled = value(enabledKey);
  const enabledValue = rawEnabled === undefined ? false : rawEnabled;
  if (enabledValue !== true && enabledValue !== false && enabledValue !== "true" && enabledValue !== "false") invalid();
  const enabled = enabledValue === true || enabledValue === "true";
  const rawRate = value(rateKey);
  if (enabled && rawRate == null) invalid();
  const rateValue = rawRate ?? "0";
  if (!["string", "number"].includes(typeof rateValue) || !/^(?:0(?:\.[0-9]{1,4})?|1(?:\.0{1,4})?)$/.test(String(rateValue))) invalid();
  const storedTtl = value("pricing.quote_ttl_minutes");
  const rawTtl = storedTtl === undefined ? "15" : storedTtl;
  if (!["string", "number"].includes(typeof rawTtl) || !/^\d+$/.test(String(rawTtl))) invalid();
  const ttl = Number(rawTtl);
  if (!Number.isSafeInteger(ttl) || ttl < 1 || ttl > 120) invalid();
  return {
    tax: { enabled, rate: new Decimal(String(rateValue)), source: "system_setting:" + prefix },
    quoteTtlMinutes: ttl,
  };
}
