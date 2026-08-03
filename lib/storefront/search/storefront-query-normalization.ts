const MAX_QUERY_LENGTH = 160;
const MAX_TOKENS = 12;

const UNIT_ALIASES: Record<string, string> = {
  centimetre: "cm", centimetres: "cm", centimeter: "cm", centimeters: "cm",
  millimetre: "mm", millimetres: "mm", millimeter: "mm", millimeters: "mm",
  litre: "l", litres: "l", liter: "l", liters: "l",
  kilogram: "kg", kilograms: "kg", gram: "g", grams: "g",
  gigabyte: "gb", gigabytes: "gb", terabyte: "tb", terabytes: "tb",
  inch: "in", inches: "in",
};

const BRAND_ALIASES: Record<string, string> = {
  "hp": "hewlett packard",
  "p and g": "procter gamble",
};

export type StorefrontNormalizedQuery = {
  value: string;
  tokens: string[];
  exactIdentifier: boolean;
  truncated: boolean;
};

function singularToken(token: string): string {
  // Deterministic, conservative stemming; identifiers and short words remain intact.
  if (/\d/.test(token) || token.length < 5 || token.endsWith("ss")) return token;
  if (token.endsWith("ies")) return `${token.slice(0, -3)}y`;
  if (token.endsWith("es")) return token.slice(0, -2);
  if (token.endsWith("s")) return token.slice(0, -1);
  return token;
}

export function normalizeStorefrontQuery(input: string): StorefrontNormalizedQuery {
  const source = input.normalize("NFKC").replace(/[\u0000-\u001F\u007F]/g, " ");
  const clipped = source.slice(0, MAX_QUERY_LENGTH);
  const punctuationNormalised = clipped
    .replace(/[‐‑‒–—―]/g, "-")
    .replace(/[“”„‟]/g, '"')
    .replace(/[‘’‚‛]/g, "'")
    .replace(/[^\p{L}\p{N}\s.+#&/'-]/gu, " ");
  const folded = punctuationNormalised.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase("en-ZA");
  const originalTokens = folded.trim().replace(/\s+/g, " ").split(" ").filter((token) => Boolean(token) && token !== "-").slice(0, MAX_TOKENS);
  const tokens = originalTokens.map((token) => {
    const aliased = UNIT_ALIASES[token] ?? BRAND_ALIASES[token] ?? token;
    return singularToken(aliased);
  });
  const value = tokens.join(" ");
  return {
    value,
    tokens,
    // GTIN, MPN and intentionally hyphenated model codes must remain exact.
    exactIdentifier: tokens.length === 1 && /^(?:\d{8,14}|[a-z]{1,8}[a-z\d]*-[a-z\d-]+)$/i.test(originalTokens[0] ?? ""),
    truncated: source.length > MAX_QUERY_LENGTH || originalTokens.length >= MAX_TOKENS && folded.trim().split(/\s+/).length > MAX_TOKENS,
  };
}

export function normalizeStorefrontFacetValue(value: string): string {
  return normalizeStorefrontQuery(value).value.slice(0, 80);
}

export const STOREFRONT_QUERY_LIMITS = { maxLength: MAX_QUERY_LENGTH, maxTokens: MAX_TOKENS } as const;
