import { expect, it } from "vitest";
import { isFrozenCourierQuote } from "@/lib/marketplace-checkout/frozen-courier-quote";
const quote = { id: "quote", currency: "ZAR", storeId: "store", calculationVersion: "marketplace-matrix-v1", ruleSnapshot: { policyAuthority: "marketplace_delivery_matrix", policyVersion: 3 } };
const valid = { quote, storeId: "store", reference: "quote", version: "marketplace-matrix:3:quote" };
it("binds the persisted matrix version to its own paid store quote", () => { expect(isFrozenCourierQuote(valid)).toBe(true); });
it.each([{ version: "phase6:quote" }, { version: "marketplace-matrix:4:quote" }, { reference: "other" }, { storeId: "other" }, { quote: { ...quote, currency: "USD" } }, { quote: { ...quote, ruleSnapshot: { policyVersion: 3 } } }])("rejects a different frozen authority %j", changed => { expect(isFrozenCourierQuote({ ...valid, ...changed })).toBe(false); });
it("preserves the exact original Phase 6 quote binding", () => { expect(isFrozenCourierQuote({ ...valid, quote: { ...quote, calculationVersion: "phase6-v1" }, version: "phase6:quote" })).toBe(true); });
