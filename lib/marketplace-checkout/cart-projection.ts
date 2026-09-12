/* eslint-disable @typescript-eslint/no-explicit-any -- dynamic projection over database catalog and cart models */
import { prisma } from "@/lib/db/prisma";
import type { MarketplaceCartState } from "@/lib/marketplace-checkout/cart-mutation.service";

export interface HydratedCartModifier {
  groupReference: string;
  groupName: string;
  optionReference: string;
  optionName: string;
  quantity: number;
  priceDelta: string;
}

export interface HydratedCartLine {
  reference: string;
  productReference: string;
  variantReference: string;
  offerReference: string;
  title: string;
  variantTitle: string | null;
  quantity: number;
  baseUnitPrice: string;
  modifierUnitTotal: string;
  effectiveUnitPrice: string;
  lineTotal: string;
  modifiers: HydratedCartModifier[];
}

export interface HydratedCartStoreGroup {
  storeId: string;
  storeReference: string;
  storeName: string;
  storeSlug: string;
  fulfilmentMode: string;
  totals: {
    merchandiseSubtotal: string;
    modifierSubtotal: string;
    subtotal: string;
  };
  lines: HydratedCartLine[];
}

export interface HydratedPublicCart {
  reference: string;
  status: string;
  currency: "ZAR";
  version: number;
  itemCount: number;
  totals: {
    merchandiseSubtotal: string;
    modifierSubtotal: string;
    grandTotal: string;
  };
  storeGroups: HydratedCartStoreGroup[];
}

/**
 * Projects a raw or state-level MarketplaceCart into a server-authoritative,
 * display-safe DTO. Clients never calculate prices, discounts, or subtotals.
 */
export async function projectHydratedCart(cart: MarketplaceCartState | any): Promise<HydratedPublicCart> {
  const rawLines: any[] = cart.lines ?? [];
  const storeIdSet = new Set<string>();
  const offerRefSet = new Set<string>();

  for (const line of rawLines) {
    if (line.storeId) storeIdSet.add(line.storeId);
    if (line.selection?.offerReference) offerRefSet.add(line.selection.offerReference);
  }

  // Fetch store details
  const stores = storeIdSet.size > 0
    ? await prisma.store.findMany({
        where: { id: { in: [...storeIdSet] } },
        select: { id: true, name: true, slug: true },
      })
    : [];
  const storeMap = new Map<string, { id: string; name: string; slug: string }>();
  for (const s of stores) storeMap.set(s.id, s);

  // Fetch offer details (including product and variant titles, and modifier groups/options)
  const offers = offerRefSet.size > 0
    ? await (prisma as any).storeCatalogOffer.findMany({
        where: { publicReference: { in: [...offerRefSet] } },
        include: {
          product: { select: { title: true, slug: true, publicReference: true } },
          variant: { select: { title: true, publicReference: true } },
          modifierGroups: {
            include: {
              group: {
                include: {
                  options: true,
                },
              },
            },
          },
        },
      })
    : [];

  const offerMap = new Map<string, any>();
  const modifierGroupMap = new Map<string, string>(); // ref -> name
  const modifierOptionMap = new Map<string, string>(); // ref -> name

  for (const offer of offers) {
    offerMap.set(offer.publicReference, offer);
    for (const mg of offer.modifierGroups ?? []) {
      if (mg.group?.publicReference) {
        modifierGroupMap.set(mg.group.publicReference, mg.group.name);
        for (const opt of mg.group.options ?? []) {
          if (opt.publicReference) {
            modifierOptionMap.set(opt.publicReference, opt.name);
          }
        }
      }
    }
  }

  // Group lines by storeId
  const groupsByStore = new Map<string, any[]>();
  for (const line of rawLines) {
    const storeId = line.storeId ?? "unknown";
    groupsByStore.set(storeId, [...(groupsByStore.get(storeId) ?? []), line]);
  }

  let grandMerchandiseSubtotal = 0;
  let grandModifierSubtotal = 0;
  let grandItemCount = 0;

  const storeGroups: HydratedCartStoreGroup[] = [];

  for (const [storeId, lines] of groupsByStore.entries()) {
    const storeInfo = storeMap.get(storeId);
    let storeMerchandiseSubtotal = 0;
    let storeModifierSubtotal = 0;

    const enrichedLines: HydratedCartLine[] = lines.map((line) => {
      const offer = offerMap.get(line.selection?.offerReference);
      const basePrice = Number(line.selection?.unitPrice ?? 0);
      const qty = Number(line.quantity ?? 1);
      grandItemCount += qty;

      let lineModifierDeltaPerUnit = 0;
      const enrichedModifiers: HydratedCartModifier[] = (line.selection?.modifiers ?? []).map((m: any) => {
        const delta = Number(m.priceDelta ?? 0);
        const mQty = Number(m.quantity ?? 1);
        lineModifierDeltaPerUnit += delta * mQty;
        return {
          groupReference: m.groupReference,
          groupName: modifierGroupMap.get(m.groupReference) ?? m.groupReference,
          optionReference: m.optionReference,
          optionName: modifierOptionMap.get(m.optionReference) ?? m.optionReference,
          quantity: mQty,
          priceDelta: delta.toFixed(2),
        };
      });

      const effectiveUnitPrice = basePrice + lineModifierDeltaPerUnit;
      const lineMerchandiseTotal = basePrice * qty;
      const lineModifierTotal = lineModifierDeltaPerUnit * qty;
      const totalLine = effectiveUnitPrice * qty;

      storeMerchandiseSubtotal += lineMerchandiseTotal;
      storeModifierSubtotal += lineModifierTotal;

      return {
        reference: line.publicReference,
        productReference: line.selection?.productReference ?? "",
        variantReference: line.selection?.variantReference ?? "",
        offerReference: line.selection?.offerReference ?? "",
        title: offer?.product?.title ?? "Product",
        variantTitle: offer?.variant?.title ?? null,
        quantity: qty,
        baseUnitPrice: basePrice.toFixed(2),
        modifierUnitTotal: lineModifierDeltaPerUnit.toFixed(2),
        effectiveUnitPrice: effectiveUnitPrice.toFixed(2),
        lineTotal: totalLine.toFixed(2),
        modifiers: enrichedModifiers,
      };
    });

    grandMerchandiseSubtotal += storeMerchandiseSubtotal;
    grandModifierSubtotal += storeModifierSubtotal;

    const storeGrand = storeMerchandiseSubtotal + storeModifierSubtotal;

    storeGroups.push({
      storeId,
      storeReference: storeInfo?.slug ?? storeId,
      storeName: storeInfo?.name ?? "Store",
      storeSlug: storeInfo?.slug ?? storeId,
      fulfilmentMode: lines[0]?.selection?.fulfilmentMode ?? "COURIER_DELIVERY",
      totals: {
        merchandiseSubtotal: storeMerchandiseSubtotal.toFixed(2),
        modifierSubtotal: storeModifierSubtotal.toFixed(2),
        subtotal: storeGrand.toFixed(2),
      },
      lines: enrichedLines,
    });
  }

  const grandTotal = grandMerchandiseSubtotal + grandModifierSubtotal;

  return {
    reference: cart.publicReference,
    status: cart.status,
    currency: "ZAR",
    version: cart.version,
    itemCount: grandItemCount,
    totals: {
      merchandiseSubtotal: grandMerchandiseSubtotal.toFixed(2),
      modifierSubtotal: grandModifierSubtotal.toFixed(2),
      grandTotal: grandTotal.toFixed(2),
    },
    storeGroups,
  };
}
