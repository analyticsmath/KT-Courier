import { describe, expect, it } from "vitest";
import { PricingError } from "@/lib/pricing/errors";
import { ownedActiveQuoteForOrder } from "@/lib/services/pricing-quote.service";
import { updatePricingRule } from "@/lib/services/pricing.service";
import { createPersistedQuote, createUser, integrationPrisma, uniqueTag } from "./phase7-5-fixtures";

describe("Phase 7.5 live pricing persistence", () => {
  it("persists quote snapshots and line items while later rule changes leave them immutable", async () => {
    const customer = await createUser(uniqueTag("pricing-customer"), "CUSTOMER");
    const { quote, rule } = await createPersistedQuote(customer, uniqueTag("pricing-persist"));
    const before = await integrationPrisma.pricingQuote.findUniqueOrThrow({ where: { id: quote.id }, include: { lineItems: true } });
    await updatePricingRule(rule.id, { expectedRevision: 1, changeReason: "Increase future base fee", baseFee: 120, amount: 120 });
    const after = await integrationPrisma.pricingQuote.findUniqueOrThrow({ where: { id: quote.id }, include: { lineItems: true } });

    expect(after.total.toFixed(2)).toBe(before.total.toFixed(2));
    expect(after.ruleSnapshot).toEqual(before.ruleSnapshot);
    expect(after.lineItems.map((item) => item.amount.toFixed(2))).toEqual(before.lineItems.map((item) => item.amount.toFixed(2)));
    expect((await integrationPrisma.pricingRule.findUniqueOrThrow({ where: { id: rule.id } })).revision).toBe(2);
  });

  it("rejects expired quotes and rolls back a claim when a later transaction step fails", async () => {
    const customer = await createUser(uniqueTag("pricing-expiry"), "CUSTOMER");
    const expired = await createPersistedQuote(customer, uniqueTag("pricing-expired"), { expiresAt: new Date(Date.now() - 1_000) });
    await expect(integrationPrisma.$transaction((tx) => ownedActiveQuoteForOrder(tx, customer, expired.quote.id, expired.quote.inputHash))).rejects.toMatchObject({ code: "QUOTE_EXPIRED" } satisfies Partial<PricingError>);

    const active = await createPersistedQuote(customer, uniqueTag("pricing-rollback"));
    await expect(integrationPrisma.$transaction(async (tx) => {
      await ownedActiveQuoteForOrder(tx, customer, active.quote.id, active.quote.inputHash);
      throw new Error("PHASE7_5_FORCED_ROLLBACK");
    })).rejects.toThrow("PHASE7_5_FORCED_ROLLBACK");
    const reloaded = await integrationPrisma.pricingQuote.findUniqueOrThrow({ where: { id: active.quote.id }, include: { order: true } });
    expect(reloaded.status).toBe("ACTIVE");
    expect(reloaded.usedAt).toBeNull();
    expect(reloaded.order).toBeNull();
  });
});
