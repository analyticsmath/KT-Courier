/* eslint-disable @typescript-eslint/no-explicit-any -- Phase 20 delegates remain dynamic until Prisma generation is permitted in Phase 26.5. */
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db/prisma";
import { MarketplaceCheckoutError } from "@/lib/marketplace-checkout/errors";
import { assertCartMutable, assertSupportedQuantity, cartLineFingerprint, MAX_CART_LINES, MAX_CART_STORES } from "@/lib/marketplace-checkout/policy";

type MarketplaceDelegate = {
  findFirst: (args: unknown) => Promise<any>;
  findUnique: (args: unknown) => Promise<any>;
  create: (args: unknown) => Promise<any>;
  update: (args: unknown) => Promise<any>;
  updateMany: (args: unknown) => Promise<{ count: number }>;
  delete: (args: unknown) => Promise<any>;
};
type MarketplaceDatabase = Record<string, MarketplaceDelegate> & { $transaction?: <T>(work: (db: MarketplaceDatabase) => Promise<T>) => Promise<T> };
const db = prisma as unknown as MarketplaceDatabase;

function delegate(database: MarketplaceDatabase, key: string): MarketplaceDelegate {
  const value = database[key];
  if (!value) throw new MarketplaceCheckoutError("CART_NOT_FOUND", "Marketplace checkout schema is not available in this runtime.");
  return value;
}
function reference(prefix: string): string { return `${prefix}_${randomUUID().replaceAll("-", "")}`; }

export type CartOwner = { type: "CUSTOMER"; userId: string } | { type: "GUEST"; guestTokenHash: string };
export type CartMutation = { operationId: string; requestHash: string; expectedVersion: number };
export type CartLineSelection = {
  offerReference: string; variantReference: string; productReference: string; storeId: string;
  fulfilmentMode: string; publicationVersion: string; priceVersion: string; unitPrice: string; quantity: number;
  modifiers: { groupReference: string; optionReference: string; quantity: number; priceDelta: string }[];
};

export function ownerWhere(owner: CartOwner): Record<string, unknown> {
  return owner.type === "CUSTOMER" ? { ownerType: "CUSTOMER", customerUserId: owner.userId } : { ownerType: "GUEST", guestTokenHash: owner.guestTokenHash };
}

/** Resolves client references against Phase 18 records; clients never supply store, price or modifier amounts. */
export async function resolveMarketplaceCartLine(input: { offerReference: string; variantReference: string; modifiers: readonly { groupReference: string; optionReference: string; quantity: number }[]; quantity: number }): Promise<CartLineSelection> {
  assertSupportedQuantity(input.quantity);
  const offer = await prisma.storeCatalogOffer.findFirst({
    where: { publicReference: input.offerReference, variant: { publicReference: input.variantReference }, status: "ACTIVE", publicationStatus: "PUBLISHED" },
    include: { product: true, variant: true, modifierGroups: { include: { group: { include: { options: true } } } } },
  });
  if (!offer) throw new MarketplaceCheckoutError("CART_LINE_INVALID", "The selected item is unavailable.");
  if (offer.sellingUnit === "VARIABLE_WEIGHT" && !offer.packagedQuantity) throw new MarketplaceCheckoutError("CART_LINE_INVALID", "Variable-weight items cannot be checked out yet.");
  const price = await prisma.storeOfferPriceVersion.findFirst({ where: { offerId: offer.id, status: "ACTIVE", effectiveFrom: { lte: new Date() }, OR: [{ effectiveUntil: null }, { effectiveUntil: { gt: new Date() } }] }, orderBy: { versionNumber: "desc" } });
  if (!price || price.currency !== "ZAR") throw new MarketplaceCheckoutError("CART_LINE_INVALID", "The selected item has no active price.");
  const attached = new Map(offer.modifierGroups.map((link) => [link.group.publicReference, link.group]));
  const selections = input.modifiers.map((selection) => {
    assertSupportedQuantity(selection.quantity);
    const group = attached.get(selection.groupReference);
    const option = group?.options.find((item) => item.publicReference === selection.optionReference && item.status === "ACTIVE");
    if (!group || group.status !== "ACTIVE" || !option) throw new MarketplaceCheckoutError("CART_LINE_INVALID", "The selected modifier is unavailable.");
    return { groupReference: group.publicReference, optionReference: option.publicReference, quantity: selection.quantity, priceDelta: option.priceDelta.toFixed(2) };
  });
  for (const group of attached.values()) {
    const count = selections.filter((item) => item.groupReference === group.publicReference).reduce((sum, item) => sum + item.quantity, 0);
    if (count < group.minimumSelections || count > group.maximumSelections || (group.isRequired && count === 0)) throw new MarketplaceCheckoutError("CART_LINE_INVALID", "Modifier selection does not satisfy this item.");
  }
  return { offerReference: offer.publicReference, variantReference: offer.variant.publicReference, productReference: offer.product.publicReference, storeId: offer.storeId, fulfilmentMode: offer.fulfilmentMode, publicationVersion: String(offer.version), priceVersion: price.publicReference, unitPrice: price.amount.toFixed(2), quantity: input.quantity, modifiers: selections };
}

export async function getOrCreateMarketplaceCart(input: { owner: CartOwner; serviceAreaReference?: string | null }, database = db): Promise<any> {
  const carts = delegate(database, "marketplaceCart");
  const existing = await carts.findFirst({ where: { ...ownerWhere(input.owner), status: "ACTIVE" }, include: { storeGroups: { include: { lines: { include: { modifiers: true } } } } } });
  if (existing) return existing;
  return carts.create({ data: {
    publicReference: reference("cart"), ownerType: input.owner.type,
    customerUserId: input.owner.type === "CUSTOMER" ? input.owner.userId : null,
    guestTokenHash: input.owner.type === "GUEST" ? input.owner.guestTokenHash : null,
    serviceAreaReference: input.serviceAreaReference ?? null, status: "ACTIVE", currency: "ZAR",
  }, include: { storeGroups: { include: { lines: { include: { modifiers: true } } } } } });
}

export function mergeCartLines<T extends { fingerprint: string; quantity: number; source: "guest" | "customer" }>(guest: readonly T[], customer: readonly T[]): { lines: T[]; conflicts: string[] } {
  const byFingerprint = new Map<string, T>(); const conflicts: string[] = [];
  for (const item of [...customer, ...guest]) {
    assertSupportedQuantity(item.quantity);
    const current = byFingerprint.get(item.fingerprint);
    if (!current) { byFingerprint.set(item.fingerprint, { ...item }); continue; }
    const combined = current.quantity + item.quantity;
    if (combined > 99) { conflicts.push(`QUANTITY_CAPPED:${item.fingerprint}`); current.quantity = 99; }
    else current.quantity = combined;
  }
  return { lines: [...byFingerprint.values()], conflicts };
}

export async function addMarketplaceCartLine(input: { cartId: string; owner: CartOwner; mutation: CartMutation; selection: CartLineSelection }, database = db): Promise<any> {
  assertSupportedQuantity(input.selection.quantity);
  const carts = delegate(database, "marketplaceCart"); const operations = delegate(database, "marketplaceCartOperation");
  const cart = await carts.findFirst({ where: { id: input.cartId, ...ownerWhere(input.owner) }, include: { storeGroups: { include: { lines: true } } } });
  if (!cart) throw new MarketplaceCheckoutError("CART_ACCESS_DENIED", "Cart is unavailable.");
  assertCartMutable(cart.status);
  if (cart.version !== input.mutation.expectedVersion) throw new MarketplaceCheckoutError("CART_VERSION_CONFLICT", "Cart changed. Refresh and try again.");
  const prior = await operations.findUnique({ where: { cartId_operationId: { cartId: input.cartId, operationId: input.mutation.operationId } } });
  if (prior) {
    if (prior.requestHash !== input.mutation.requestHash) throw new MarketplaceCheckoutError("CART_OPERATION_CONFLICT", "Operation identifier was reused for a different request.");
    return prior.response;
  }
  const allLines = cart.storeGroups.flatMap((group: any) => group.lines);
  if (allLines.length >= MAX_CART_LINES) throw new MarketplaceCheckoutError("CART_LINE_INVALID", "Cart line limit reached.");
  const group = cart.storeGroups.find((item: any) => item.storeId === input.selection.storeId);
  if (!group && cart.storeGroups.length >= MAX_CART_STORES) throw new MarketplaceCheckoutError("CART_LINE_INVALID", "Cart store limit reached.");
  const fingerprint = cartLineFingerprint({ offerReference: input.selection.offerReference, variantReference: input.selection.variantReference, modifiers: input.selection.modifiers.map((item) => ({ groupReference: item.groupReference, optionReference: item.optionReference, quantity: item.quantity })) });
  const response = { cartReference: cart.publicReference, fingerprint, replayed: false };
  const createGroup = !group;
  const result = await carts.update({ where: { id: cart.id }, data: {
    version: { increment: 1 }, lastActivityAt: new Date(),
    storeGroups: createGroup ? { create: { storeId: input.selection.storeId, fulfilmentMode: input.selection.fulfilmentMode, lines: { create: { publicReference: reference("line"), productPublicReference: input.selection.productReference, variantPublicReference: input.selection.variantReference, offerPublicReference: input.selection.offerReference, quantity: input.selection.quantity, observedPublicationVersion: input.selection.publicationVersion, observedPriceVersion: input.selection.priceVersion, observedUnitPrice: input.selection.unitPrice, lineFingerprint: fingerprint, modifiers: { create: input.selection.modifiers.map((item) => ({ modifierGroupPublicReference: item.groupReference, modifierOptionPublicReference: item.optionReference, quantity: item.quantity, observedPriceDelta: item.priceDelta })) } } } } } : undefined,
  } });
  if (!createGroup) {
    const lines = delegate(database, "marketplaceCartLine");
    const current = await lines.findFirst({ where: { cartId: cart.id, lineFingerprint: fingerprint } });
    if (current) await lines.update({ where: { id: current.id }, data: { quantity: { increment: input.selection.quantity }, version: { increment: 1 } } });
    else await lines.create({ data: { publicReference: reference("line"), cartId: cart.id, storeGroupId: group.id, productPublicReference: input.selection.productReference, variantPublicReference: input.selection.variantReference, offerPublicReference: input.selection.offerReference, quantity: input.selection.quantity, observedPublicationVersion: input.selection.publicationVersion, observedPriceVersion: input.selection.priceVersion, observedUnitPrice: input.selection.unitPrice, lineFingerprint: fingerprint, modifiers: { create: input.selection.modifiers.map((item) => ({ modifierGroupPublicReference: item.groupReference, modifierOptionPublicReference: item.optionReference, quantity: item.quantity, observedPriceDelta: item.priceDelta })) } } });
  }
  await operations.create({ data: { cartId: cart.id, operationId: input.mutation.operationId, requestHash: input.mutation.requestHash, type: "ADD_LINE", response } });
  return { ...response, cartVersion: result.version };
}
