import { expect, test } from "vitest";
import { assertStorefrontEditorialTransition } from "@/lib/storefront/storefront-editorial-policy";
test("collection lifecycle permits only reviewed transitions and source-locked activation", () => { expect(() => assertStorefrontEditorialTransition("DRAFT", "UNDER_REVIEW")).not.toThrow(); expect(() => assertStorefrontEditorialTransition("DRAFT", "ACTIVE")).toThrow("lifecycle"); expect(() => assertStorefrontEditorialTransition("APPROVED", "ACTIVE")).toThrow("consolidated validation"); });
