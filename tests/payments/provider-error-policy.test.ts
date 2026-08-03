import { describe, expect, it } from "vitest";
import { definitiveProviderError, normalizeProviderError } from "@/lib/payments/providers/provider-errors";

describe("provider error policy", () => {
  it("treats timeout as unknown rather than failure", () => { const error = new Error(); error.name = "AbortError"; expect(normalizeProviderError(error)).toMatchObject({ category: "TIMEOUT", definitive: false }); });
  it("normalizes configuration failures without raw errors", () => expect(definitiveProviderError("CONFIGURATION", "MISSING")).toMatchObject({ configurationFault: true, definitive: true }));
});

