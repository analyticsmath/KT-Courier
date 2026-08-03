import { Prisma } from "@prisma/client";
import { PricingError } from "./errors";

export const Decimal = Prisma.Decimal;
export const ZERO = new Decimal(0);
export const HUNDRED = new Decimal(100);

/** Authoritative money conversion. Native numbers are deliberately rejected. */
export function decimal(value: string | Prisma.Decimal | bigint): Prisma.Decimal {
  if (typeof value === "number") throw new PricingError("INVALID_DECIMAL", "Native numbers are not accepted for pricing.");
  try {
    const result = new Decimal(typeof value === "bigint" ? value.toString() : value);
    if (!result.isFinite() || result.isNaN()) throw new Error("not finite");
    return result;
  } catch {
    throw new PricingError("INVALID_DECIMAL", "Invalid decimal value.");
  }
}

export function roundMoney(value: Prisma.Decimal): Prisma.Decimal {
  return value.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

export function assertNonNegative(value: Prisma.Decimal, field: string): Prisma.Decimal {
  if (value.lessThan(ZERO)) throw new PricingError("NEGATIVE_PRICING", `${field} cannot be negative.`);
  return value;
}

export function moneyString(value: Prisma.Decimal): string {
  return roundMoney(value).toFixed(2);
}

export function decimalString(value: Prisma.Decimal): string {
  return value.toString();
}
