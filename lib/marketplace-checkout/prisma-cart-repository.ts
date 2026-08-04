/* eslint-disable @typescript-eslint/no-explicit-any -- Prisma generation is intentionally deferred; the adapter is isolated here. */
import { prisma } from "@/lib/db/prisma";
import type { CartOwner } from "@/lib/marketplace-checkout/cart.service";
import type { CartOperationResult, MarketplaceCartMutationRepository, MarketplaceCartOperationType, MarketplaceCartState } from "@/lib/marketplace-checkout/cart-mutation.service";

type Db = any;
function ownerWhere(owner: CartOwner) { return owner.type === "CUSTOMER" ? { ownerType: "CUSTOMER", customerUserId: owner.userId } : { ownerType: "GUEST", guestTokenHash: owner.guestTokenHash }; }
function toState(row: any): MarketplaceCartState { return { id: row.id, publicReference: row.publicReference, owner: row.ownerType === "CUSTOMER" ? { type: "CUSTOMER", userId: row.customerUserId } : { type: "GUEST", guestTokenHash: row.guestTokenHash }, status: row.status, version: row.version, lines: row.storeGroups.flatMap((group: any) => group.lines.map((line: any) => ({ publicReference: line.publicReference, storeId: group.storeId, quantity: line.quantity, fingerprint: line.lineFingerprint, selection: { offerReference: line.offerPublicReference, variantReference: line.variantPublicReference, productReference: line.productPublicReference, storeId: group.storeId, fulfilmentMode: group.fulfilmentMode, publicationVersion: line.observedPublicationVersion, priceVersion: line.observedPriceVersion, unitPrice: line.observedUnitPrice.toFixed(2), quantity: line.quantity, modifiers: line.modifiers.map((modifier: any) => ({ groupReference: modifier.modifierGroupPublicReference, optionReference: modifier.modifierOptionPublicReference, quantity: modifier.quantity, priceDelta: modifier.observedPriceDelta.toFixed(2) })) } }))) }; }
const include = { storeGroups: { include: { lines: { include: { modifiers: true } } } } } as const;
async function lock(db: Db, id: string) { await db.$queryRawUnsafe('SELECT "id" FROM "MarketplaceCart" WHERE "id" = $1 FOR UPDATE', id); return db.marketplaceCart.findUnique({ where: { id }, include }); }

export function createPrismaMarketplaceCartRepository(database: Db = prisma): MarketplaceCartMutationRepository & { lockCartByOwner(owner: CartOwner, options?: Readonly<{ includeMerged?: boolean }>): Promise<MarketplaceCartState | null>; markMerged(guestCartId: string, customerCartId: string): Promise<void>; create(owner: CartOwner): Promise<MarketplaceCartState> } {
  const current = () => database;
  const repository: any = {
    async transaction(work: () => Promise<any>) { return current().$transaction(async (tx: Db) => { const previous = database; database = tx; try { return await work(); } finally { database = previous; } }, { isolationLevel: "Serializable" }); },
    async lockCart(id: string) { const row = await lock(current(), id); return row ? toState(row) : null; },
    async lockCartByOwner(owner: CartOwner, options?: Readonly<{ includeMerged?: boolean }>) {
      const active = await current().marketplaceCart.findFirst({ where: { ...ownerWhere(owner), status: { in: ["ACTIVE", "CHECKOUT_LOCKED"] } }, include });
      const row = active ?? (options?.includeMerged ? await current().marketplaceCart.findFirst({ where: { ...ownerWhere(owner), status: "MERGED" }, include }) : null);
      if (!row) return null;
      const locked = await lock(current(), row.id);
      return locked ? toState(locked) : null;
    },
    async findCartByOwner(owner: CartOwner) { const row = await current().marketplaceCart.findFirst({ where: { ...ownerWhere(owner), status: "ACTIVE" }, include }); return row ? toState(row) : null; },
    async create(owner: CartOwner) { const row = await current().marketplaceCart.create({ data: { publicReference: `cart_${crypto.randomUUID().replaceAll("-", "")}`, ownerType: owner.type, customerUserId: owner.type === "CUSTOMER" ? owner.userId : null, guestTokenHash: owner.type === "GUEST" ? owner.guestTokenHash : null, currency: "ZAR", status: "ACTIVE" }, include }); return toState(row); },
    async saveCart(cart: MarketplaceCartState) {
      const db = current();
      await db.marketplaceCartLineModifier.deleteMany({ where: { cartLine: { cartId: cart.id } } });
      await db.marketplaceCartLine.deleteMany({ where: { cartId: cart.id } });
      await db.marketplaceCartStoreGroup.deleteMany({ where: { cartId: cart.id } });
      await db.marketplaceCart.update({ where: { id: cart.id }, data: { ownerType: cart.owner.type, customerUserId: cart.owner.type === "CUSTOMER" ? cart.owner.userId : null, guestTokenHash: cart.owner.type === "GUEST" ? cart.owner.guestTokenHash : null, version: cart.version, lastActivityAt: new Date(), storeGroups: { create: groupData(cart) } } });
    },
    async readOperation(cartId: string, operationId: string) { const row = await current().marketplaceCartOperation.findUnique({ where: { cartId_operationId: { cartId, operationId } } }); return row ? { requestHash: row.requestHash, result: row.response as CartOperationResult } : null; },
    async appendOperation(cartId: string, operationId: string, requestHash: string, result: CartOperationResult, type: MarketplaceCartOperationType) { await current().marketplaceCartOperation.create({ data: { cartId, operationId, requestHash, type, response: result } }); },
    async markMerged(guestCartId: string, customerCartId: string) { await current().marketplaceCart.update({ where: { id: guestCartId }, data: { status: "MERGED", mergedIntoCartId: customerCartId, guestTokenVersion: { increment: 1 } } }); },
  };
  return repository;
}
function groupData(cart: MarketplaceCartState) {
  const byStore = new Map<string, MarketplaceCartState["lines"]>();
  for (const line of cart.lines) byStore.set(line.storeId, [...(byStore.get(line.storeId) ?? []), line]);
  return [...byStore.entries()].map(([storeId, lines]) => ({ storeId, fulfilmentMode: lines[0]!.selection.fulfilmentMode, lines: { create: lines.map((line) => ({ publicReference: line.publicReference, productPublicReference: line.selection.productReference, variantPublicReference: line.selection.variantReference, offerPublicReference: line.selection.offerReference, quantity: line.quantity, observedPublicationVersion: line.selection.publicationVersion, observedPriceVersion: line.selection.priceVersion, observedUnitPrice: line.selection.unitPrice, lineFingerprint: line.fingerprint, modifiers: { create: line.selection.modifiers.map((modifier) => ({ modifierGroupPublicReference: modifier.groupReference, modifierOptionPublicReference: modifier.optionReference, quantity: modifier.quantity, observedPriceDelta: modifier.priceDelta })) } })) } }));
}
