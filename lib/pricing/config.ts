import { prisma } from "@/lib/db/prisma";
import { Decimal } from "./money";

export const PRICING_CALCULATION_VERSION = "pricing-engine-v1";

export async function getPricingConfiguration() {
  const settings = await prisma.systemSetting.findMany({ where: { key: { in: ["pricing.vat.enabled", "pricing.vat.rate", "pricing.quote_ttl_minutes"] } } });
  const value = (key: string, fallback: string) => {
    const raw = settings.find((setting) => setting.key === key)?.value;
    return typeof raw === "string" ? raw : fallback;
  };
  const ttl = Number.parseInt(value("pricing.quote_ttl_minutes", "15"), 10);
  return {
    tax: { enabled: value("pricing.vat.enabled", "false") === "true", rate: new Decimal(value("pricing.vat.rate", "0.1500")), source: "system_setting:pricing.vat" },
    quoteTtlMinutes: Number.isInteger(ttl) && ttl > 0 && ttl <= 120 ? ttl : 15,
  };
}
