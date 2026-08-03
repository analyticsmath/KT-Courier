import { describe, expect, it } from "vitest";
import { PricingError } from "@/lib/pricing/errors";
import { createOrder } from "@/lib/services/orders.service";
import { createPersistedQuote, createUser, integrationPrisma, uniqueTag } from "./phase7-5-fixtures";

describe("Phase 7.5 live quote-to-order consumption", () => {
  it("creates one immutable order from an owned active quote", async () => {
    const customer = await createUser(uniqueTag("orders-customer"), "CUSTOMER");
    const { quote, input } = await createPersistedQuote(customer, uniqueTag("orders-quote"));
    const order = await createOrder(customer, input);
    const reloaded = await integrationPrisma.order.findUniqueOrThrow({ where: { id: order.id }, include: { pricingQuote: true, statusHistory: true } });

    expect(reloaded.pricingQuoteId).toBe(quote.id);
    expect(reloaded.priceEstimate?.toFixed(2)).toBe("115.00");
    expect(reloaded.pricingQuote?.status).toBe("USED");
    expect(reloaded.statusHistory).toHaveLength(1);
    await expect(createOrder(customer, input)).rejects.toMatchObject({ code: "QUOTE_ALREADY_USED" } satisfies Partial<PricingError>);
  });

  it("does not disclose or consume a quote belonging to another customer", async () => {
    const owner = await createUser(uniqueTag("orders-owner"), "CUSTOMER");
    const other = await createUser(uniqueTag("orders-other"), "CUSTOMER");
    const { quote, input } = await createPersistedQuote(owner, uniqueTag("orders-isolation"));

    await expect(createOrder(other, input)).rejects.toMatchObject({ code: "QUOTE_OWNER_MISMATCH" } satisfies Partial<PricingError>);
    expect((await integrationPrisma.pricingQuote.findUniqueOrThrow({ where: { id: quote.id } })).status).toBe("ACTIVE");
  });
});
