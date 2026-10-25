import { z } from "zod";
import { CatalogPolicyError } from "@/lib/catalog/errors";

const money = z.string().regex(/^(?:0|[1-9]\d{0,14})\.\d{2}$/).refine(v => BigInt(v.replace(".", "")) > 0n);
const tierSchema = z.array(z.object({ minQuantity: z.number().int().min(2).max(99), unitPrice: money }).strict()).max(10);
export type VolumePriceTier = { minQuantity: number; unitPrice: string };
const cents = (s: string) => BigInt(s.replace(".", ""));

export function parseVolumePriceTiers(basePrice: string, raw: unknown): VolumePriceTier[] {
  if (!money.safeParse(basePrice).success) throw new CatalogPolicyError("PRICE_INVALID", "Base price must be a positive ZAR amount.");
  const result=tierSchema.safeParse(raw);
  if(!result.success)throw new CatalogPolicyError("VOLUME_TIERS_INVALID", "Each tier needs a distinct quantity 2–99 and an exact ZAR unit price.");
  let previousQuantity = 1;
  let previousPrice = cents(basePrice);
  for (const row of result.data) {
    if (row.minQuantity <= previousQuantity || cents(row.unitPrice) >= previousPrice)
      throw new CatalogPolicyError("VOLUME_TIERS_INVALID", "Discount tiers must rise in quantity and decrease in unit price.");
    previousQuantity = row.minQuantity;
    previousPrice = cents(row.unitPrice);
  }
  return result.data;
}
export function priceForOrderQuantity(basePrice: string, tiers: readonly VolumePriceTier[], quantity: number): string {
  if(!Number.isInteger(quantity)||quantity<1||quantity>99)throw new CatalogPolicyError("CART_QUANTITY_INVALID", "Invalid cart quantity.");
  const parsed=parseVolumePriceTiers(basePrice, tiers);
  return parsed.reduce((price,tier)=>quantity>=tier.minQuantity?tier.unitPrice:price,basePrice);
}
export function validatePackUnit(sellingUnit:string, packagedQuantity?:string|null, unitOfMeasure?:string|null) {
  if(!["PAIR","PACK","BULK"].includes(sellingUnit))return {packagedQuantity:undefined,unitOfMeasure:undefined};
  const qty=packagedQuantity&&/^\d{1,4}$/.test(packagedQuantity)?Number(packagedQuantity):NaN;
  if(!Number.isInteger(qty)||qty<2||qty>1000||(sellingUnit==="PAIR"&&qty!==2))
    throw new CatalogPolicyError("PACKAGE_COMPOSITION_INVALID", "Pair requires exactly two items; packs and bulk cases require 2–1000 items.");
  if(!unitOfMeasure||!/^[A-Za-z][A-Za-z -]{1,29}$/.test(unitOfMeasure))
    throw new CatalogPolicyError("PACKAGE_COMPOSITION_INVALID", "Declare a package content unit such as piece.");
  return {packagedQuantity:String(qty),unitOfMeasure:unitOfMeasure.trim()};
}
