import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { parsePayfastItnAmount, verifyPayfastItnAmount } from "@/lib/payments/providers/payfast/payfast-itn-amount";

describe("Payfast exact amount policy", () => {
  it("accepts exact positive ZAR Decimal equality", () => expect(() => verifyPayfastItnAmount("123.45", new Prisma.Decimal("123.45"), "ZAR")).not.toThrow());
  it.each(["123.456", "1e2", " 1.00", "R1.00", "1,00", "-1.00", "0", "+1.00"])("rejects invalid exact amount %s", (value) => expect(() => parsePayfastItnAmount(value)).toThrow());
  it("has no rounding or cent tolerance", () => expect(() => verifyPayfastItnAmount("123.44", new Prisma.Decimal("123.45"), "ZAR")).toThrow());
});
