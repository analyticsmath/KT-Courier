import type { NextRequest } from "next/server";
import { marketplaceError, marketplaceJson, marketplaceOwner } from "@/lib/marketplace-checkout/api-policy";
import { getMarketplaceCheckoutForOwner } from "@/lib/marketplace-checkout/checkout.service";
import { marketplaceCourierTariffPolicy } from "@/lib/marketplace-checkout/courier-tariff-policy";
import { deliveryCatalog } from "@/lib/client-platform/delivery.service";
import { prisma } from "@/lib/db/prisma";

export async function GET(request: NextRequest, context: { params: Promise<{ reference: string }> }) {
  try {
    const owner = await marketplaceOwner(request, "checkout");
    if (!owner) return marketplaceJson({ error: "Checkout access is required." }, 401);
    const { reference } = await context.params;
    const checkout = await getMarketplaceCheckoutForOwner(reference, owner);
    if (!checkout) return marketplaceJson({ error: "Checkout is unavailable." }, 404);
    const policy = await marketplaceCourierTariffPolicy();
    if (!policy) return marketplaceJson({ model: "MATRIX", services: [] });
    const services = (await deliveryCatalog()).filter(service => service.active).map(service => ({ key: service.stableKey, name: service.displayName, turnaround: service.turnaround }));
    const groups = checkout.storeGroups as Array<{ storeId: string; deliveryQuoteReference: string | null }>;
    const quotes = await prisma.pricingQuote.findMany({ where: { id: { in: groups.map(group => group.deliveryQuoteReference).filter((id): id is string => !!id) }, calculationVersion: "marketplace-courier-tariff-v1" }, select: { id: true, storeId: true, ruleSnapshot: true } });
    const priorKeys = new Set(quotes.flatMap(quote => {
      const rules = quote.ruleSnapshot as { checkoutReference?: string; serviceKey?: string } | null;
      return groups.some(group => group.storeId === quote.storeId && group.deliveryQuoteReference === quote.id) && rules?.checkoutReference === reference && services.some(service => service.key === rules.serviceKey) ? [rules!.serviceKey!] : [];
    }));
    return marketplaceJson({ model: "COURIER_TARIFFS", defaultServiceKey: policy.defaultServiceKey, selectedServiceKey: priorKeys.size === 1 ? [...priorKeys][0] : policy.defaultServiceKey, services });
  } catch (error) { return marketplaceError(error); }
}
