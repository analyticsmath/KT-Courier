import { Prisma } from "@prisma/client";
import { LEDGER_MAX_AMOUNT } from "./config";
import { LedgerError } from "./errors";

const Decimal = Prisma.Decimal;
const DECIMAL_INPUT = /^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/;
const MORE_THAN_TWO_DECIMALS = /^\d+\.\d{3,}$/;

export class LedgerMoney {
  readonly #value: Prisma.Decimal;

  private constructor(value: Prisma.Decimal) {
    this.#value = value;
    Object.freeze(this);
  }

  static zero(): LedgerMoney {
    return new LedgerMoney(new Decimal(0));
  }

  static parse(value: string): LedgerMoney {
    if (typeof value !== "string") {
      throw new LedgerError("LEDGER_INVALID_AMOUNT", "Ledger amounts must be decimal strings.");
    }
    if (MORE_THAN_TWO_DECIMALS.test(value)) {
      throw new LedgerError("LEDGER_PRECISION_EXCEEDED", "Ledger amounts may have at most two fractional digits.");
    }
    if (!DECIMAL_INPUT.test(value)) {
      throw new LedgerError("LEDGER_INVALID_AMOUNT", "Ledger amount is not a valid positive ZAR decimal.");
    }

    const decimal = new Decimal(value);
    if (!decimal.isFinite() || decimal.isNaN() || decimal.lessThanOrEqualTo(0)) {
      throw new LedgerError("LEDGER_INVALID_AMOUNT", "Ledger amount must be greater than zero.");
    }
    if (decimal.greaterThan(new Decimal(LEDGER_MAX_AMOUNT))) {
      throw new LedgerError("LEDGER_INVALID_AMOUNT", "Ledger amount exceeds the supported database precision.");
    }
    return new LedgerMoney(decimal);
  }

  static fromDecimal(value: Prisma.Decimal): LedgerMoney {
    if (!value.isFinite() || value.isNaN() || value.decimalPlaces() > 2) {
      throw new LedgerError("LEDGER_PRECISION_EXCEEDED", "Stored ledger value exceeds the supported precision.");
    }
    if (value.abs().greaterThan(new Decimal(LEDGER_MAX_AMOUNT))) {
      throw new LedgerError("LEDGER_INVALID_AMOUNT", "Stored ledger value exceeds the supported database precision.");
    }
    return new LedgerMoney(new Decimal(value));
  }

  static #fromOperation(value: Prisma.Decimal): LedgerMoney {
    if (value.abs().greaterThan(new Decimal(LEDGER_MAX_AMOUNT))) {
      throw new LedgerError("LEDGER_INVALID_AMOUNT", "Ledger calculation exceeds the supported database precision.");
    }
    return new LedgerMoney(value);
  }

  add(other: LedgerMoney): LedgerMoney {
    return LedgerMoney.#fromOperation(this.#value.add(other.#value));
  }

  subtract(other: LedgerMoney): LedgerMoney {
    return LedgerMoney.#fromOperation(this.#value.sub(other.#value));
  }

  negate(): LedgerMoney {
    return LedgerMoney.#fromOperation(this.#value.negated());
  }

  equals(other: LedgerMoney): boolean {
    return this.#value.equals(other.#value);
  }

  lessThan(other: LedgerMoney): boolean {
    return this.#value.lessThan(other.#value);
  }

  greaterThan(other: LedgerMoney): boolean {
    return this.#value.greaterThan(other.#value);
  }

  isZero(): boolean {
    return this.#value.isZero();
  }

  toDecimal(): Prisma.Decimal {
    return new Decimal(this.#value);
  }

  toString(): string {
    return this.#value.toFixed(2);
  }
}

export function sumLedgerMoney(values: readonly LedgerMoney[]): LedgerMoney {
  return values.reduce((total, value) => total.add(value), LedgerMoney.zero());
}
