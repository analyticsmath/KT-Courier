import { describe, expect, it } from "vitest";
import { createOrder } from "@/lib/services/orders.service";
import { createPersistedQuote, createUser, integrationPrisma, uniqueTag } from "./phase7-5-fixtures";

describe("Phase 7.5 live quote concurrency", () => {
  it("allows exactly one concurrent order to consume a quote", async () => {
    const customer = await createUser(uniqueTag("pricing-race"), "CUSTOMER");
    const { quote, input } = await createPersistedQuote(customer, uniqueTag("pricing-race-quote"));
    const outcomes = await Promise.allSettled([createOrder(customer, input), createOrder(customer, input)]);
    const successful = outcomes.filter((outcome) => outcome.status === "fulfilled");
    const rejected = outcomes.filter((outcome) => outcome.status === "rejected");
    const reloaded = await integrationPrisma.pricingQuote.findUniqueOrThrow({ where: { id: quote.id }, include: { order: true } });

    expect(successful).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(reloaded.status).toBe("USED");
    expect(reloaded.order).not.toBeNull();
    expect(await integrationPrisma.order.count({ where: { pricingQuoteId: quote.id } })).toBe(1);
  });
});
