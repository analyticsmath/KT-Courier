export type GtinType = "GTIN_8" | "GTIN_12" | "GTIN_13" | "GTIN_14";

export type GtinValidationResult =
  | { valid: true; normalized: string; type: GtinType }
  | { valid: false; code: "MISSING" | "FORMAT" | "PLACEHOLDER" | "CHECKSUM" };

export function identifierExists(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function normalizeGtin(value: string): string {
  return value.normalize("NFKC").replace(/[\s-]/g, "");
}

export function gtinTypeForLength(length: number): GtinType | null {
  if (length === 8) return "GTIN_8";
  if (length === 12) return "GTIN_12";
  if (length === 13) return "GTIN_13";
  if (length === 14) return "GTIN_14";
  return null;
}

export function calculateGtinCheckDigit(dataDigits: string): number {
  if (!/^\d+$/.test(dataDigits)) throw new Error("GTIN data must contain digits only.");
  let sum = 0;
  for (let index = dataDigits.length - 1, position = 1; index >= 0; index -= 1, position += 1) {
    sum += Number(dataDigits[index]) * (position % 2 === 1 ? 3 : 1);
  }
  return (10 - (sum % 10)) % 10;
}

export function validateGtin(value: unknown): GtinValidationResult {
  if (!identifierExists(value)) return { valid: false, code: "MISSING" };
  const normalized = normalizeGtin(value);
  const type = gtinTypeForLength(normalized.length);
  if (!type || !/^\d+$/.test(normalized)) return { valid: false, code: "FORMAT" };
  if (/^0+$/.test(normalized)) return { valid: false, code: "PLACEHOLDER" };
  const expected = calculateGtinCheckDigit(normalized.slice(0, -1));
  if (expected !== Number(normalized.at(-1))) return { valid: false, code: "CHECKSUM" };
  return { valid: true, normalized, type };
}

export function normalizeMpn(value: string): string {
  return value.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleUpperCase("en-ZA");
}

export function normalizeStoreSku(value: string): string {
  return value.normalize("NFKC").trim().replace(/\s+/g, "-").toLocaleUpperCase("en-ZA");
}

