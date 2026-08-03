import { Prisma } from "@prisma/client";
import { DriverEarningError } from "./errors";

const EXACT = /^(0|[1-9]\d{0,15})\.\d{2}$/;

export function parseDriverEarningMoney(value: string, options?: Readonly<{ allowZero?: boolean }>): Prisma.Decimal {
  if (!EXACT.test(value)) throw new DriverEarningError("DRIVER_EARNING_INVALID_SNAPSHOT", "Money must be a canonical non-negative two-decimal string.");
  const amount = new Prisma.Decimal(value);
  if (amount.isNegative() || (!options?.allowZero && amount.isZero())) throw new DriverEarningError("DRIVER_EARNING_INVALID_SNAPSHOT", "Money must satisfy the required positive amount policy.");
  return amount;
}

export function formatDriverEarningMoney(value: Prisma.Decimal): string {
  return value.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP).toFixed(2);
}
