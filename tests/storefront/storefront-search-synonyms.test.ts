import { expect, test } from "vitest";
import { expandStorefrontSynonyms, normaliseStorefrontSynonymTerms } from "@/lib/storefront/storefront-editorial-policy";
test("synonyms are normalized, directed, and never rewrite identifiers", () => { const terms = normaliseStorefrontSynonymTerms([{ input: "Herbal Tea", outputs: ["rooibos"], direction: "EQUIVALENT" }]); expect(expandStorefrontSynonyms("rooibos", terms)).toContain("herbal tea"); expect(expandStorefrontSynonyms("1234567890123", terms)).toEqual(["1234567890123"]); });
