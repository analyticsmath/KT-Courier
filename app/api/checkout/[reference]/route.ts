/* eslint-disable @typescript-eslint/no-explicit-any -- serialised database output is deliberately whitelisted into a public DTO. */
import { type NextRequest } from "next/server";
import { getMarketplaceCheckoutForOwner } from "@/lib/marketplace-checkout/checkout.service";
import { marketplaceError, marketplaceJson, marketplaceOwner } from "@/lib/marketplace-checkout/api-policy";

function publicCheckout(checkout: any) { return { reference: checkout.publicReference, status: checkout.status, currency: checkout.currency, version: checkout.version, totals: { merchandiseSubtotal: checkout.merchandiseSubtotal, modifierSubtotal: checkout.modifierSubtotal, deliveryFeeTotal: checkout.deliveryFeeTotal, grandTotal: checkout.grandTotal }, changes: (checkout.changes ?? []).map((item: any) => ({ type: item.type, lineReference: item.lineReference, acknowledgedAt: item.acknowledgedAt })), storeGroups: (checkout.storeGroups ?? []).map((group: any) => ({ storeReference: group.storeId, status: group.status, fulfilmentMode: group.fulfilmentMode, deliveryFee: group.deliveryFee, quoteReference: group.deliveryQuoteReference, quoteExpiresAt: group.deliveryQuoteExpiresAt, lines: (group.lines ?? []).map((line: any) => ({ productReference: line.productReference, variantReference: line.variantReference, offerReference: line.offerReference, quantity: line.quantity, baseUnitPrice: line.baseUnitPrice, modifierUnitTotal: line.modifierUnitTotal, lineTotal: line.lineTotal, modifiers: line.modifiers ?? [] })) })) }; }

export async function GET(request: NextRequest, context: { params: Promise<{ reference: string }> }) {
  try { const owner = await marketplaceOwner(request, "checkout"); if (!owner) return marketplaceJson({ error: "Checkout access is required." }, 401); const { reference } = await context.params; return marketplaceJson({ checkout: publicCheckout(await getMarketplaceCheckoutForOwner(reference, owner)) }); } catch (error) { return marketplaceError(error); }
}
