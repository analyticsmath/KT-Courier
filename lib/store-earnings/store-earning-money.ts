import { Prisma } from "@prisma/client";
import { StoreEarningError } from "./errors";

const EXACT_ZAR = /^(?:0|[1-9]\d{0,15})(?:\.\d{1,2})?$/;

export function parseStoreEarningMoney(value: string, options?: Readonly<{ allowZero?: boolean }>): Prisma.Decimal {
  if (typeof value !== "string" || !EXACT_ZAR.test(value)) {
    throw new StoreEarningError("STORE_EARNING_INVALID_SNAPSHOT", "Store earning amounts must be exact ZAR decimal strings with at most two fractional digits.");
  }
  const amount = new Prisma.Decimal(value);
  if (!amount.isFinite() || amount.isNaN() || amount.decimalPlaces() > 2 || amount.isNegative() || (!options?.allowZero && amount.isZero())) {
    throw new StoreEarningError("STORE_EARNING_INVALID_SNAPSHOT", "Store earning amount is outside the supported financial range.");
  }
  return amount;
}

export function formatStoreEarningMoney(value: Prisma.Decimal | string): string {
  const canonical = new Prisma.Decimal(value).toDecimalPlaces(2).toString();
  const [whole, fraction = ""] = canonical.split(".");
  return `${whole}.${fraction.padEnd(2, "0")}`;
}
