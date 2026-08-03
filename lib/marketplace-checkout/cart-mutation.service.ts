import { MarketplaceCheckoutError } from "@/lib/marketplace-checkout/errors";
import { assertCartMutable, assertSupportedQuantity, cartLineFingerprint, MAX_CART_LINES, MAX_CART_STORES } from "@/lib/marketplace-checkout/policy";
import type { CartLineSelection, CartMutation, CartOwner } from "@/lib/marketplace-checkout/cart.service";

export type MarketplaceCartLineState = Readonly<{
  publicReference: string;
  storeId: string;
  quantity: number;
  fingerprint: string;
  selection: CartLineSelection;
}>;
export type MarketplaceCartState = Readonly<{
  id: string; publicReference: string; owner: CartOwner; status: string; version: number;
  lines: readonly MarketplaceCartLineState[];
}>;
export type CartOperationResult = Readonly<{ cart: MarketplaceCartState; replayed: boolean; conflicts: readonly string[] }>;
export type MarketplaceCartMutationRepository = Readonly<{
  transaction<T>(work: () => Promise<T>): Promise<T>;
  lockCart(cartId: string): Promise<MarketplaceCartState | null>;
  findCartByOwner(owner: CartOwner): Promise<MarketplaceCartState | null>;
  saveCart(cart: MarketplaceCartState): Promise<void>;
  readOperation(cartId: string, operationId: string): Promise<{ requestHash: string; result: CartOperationResult } | null>;
  appendOperation(cartId: string, operationId: string, requestHash: string, result: CartOperationResult): Promise<void>;
}>;

function sameOwner(left: CartOwner, right: CartOwner): boolean {
  return left.type === right.type && (left.type === "CUSTOMER" ? left.userId === (right as Extract<CartOwner, { type: "CUSTOMER" }>).userId : left.guestTokenHash === (right as Extract<CartOwner, { type: "GUEST" }>).guestTokenHash);
}
function mutableCart(cart: MarketplaceCartState, owner: CartOwner, expectedVersion: number): void {
  if (!sameOwner(cart.owner, owner)) throw new MarketplaceCheckoutError("CART_ACCESS_DENIED", "Cart is unavailable.");
  assertCartMutable(cart.status);
  if (cart.version !== expectedVersion) throw new MarketplaceCheckoutError("CART_VERSION_CONFLICT", "Cart changed. Refresh and try again.");
}
async function replayOrConflict(repository: MarketplaceCartMutationRepository, cartId: string, mutation: CartMutation): Promise<CartOperationResult | null> {
  const receipt = await repository.readOperation(cartId, mutation.operationId);
  if (!receipt) return null;
  if (receipt.requestHash !== mutation.requestHash) throw new MarketplaceCheckoutError("CART_OPERATION_CONFLICT", "Operation identifier was reused for a different request.");
  return { ...receipt.result, replayed: true };
}
async function commit(repository: MarketplaceCartMutationRepository, cart: MarketplaceCartState, mutation: CartMutation, conflicts: readonly string[] = []): Promise<CartOperationResult> {
  const result: CartOperationResult = Object.freeze({ cart, replayed: false, conflicts: Object.freeze([...conflicts]) });
  await repository.saveCart(cart); await repository.appendOperation(cart.id, mutation.operationId, mutation.requestHash, result);
  return result;
}

export async function createOrResolveCart(repository: MarketplaceCartMutationRepository, owner: CartOwner, create: () => Promise<MarketplaceCartState>): Promise<MarketplaceCartState> {
  return repository.transaction(async () => (await repository.findCartByOwner(owner)) ?? create());
}

export async function addCartLine(repository: MarketplaceCartMutationRepository, input: Readonly<{ cartId: string; owner: CartOwner; mutation: CartMutation; selection: CartLineSelection }>): Promise<CartOperationResult> {
  assertSupportedQuantity(input.selection.quantity);
  return repository.transaction(async () => {
    const cart = await repository.lockCart(input.cartId); if (!cart) throw new MarketplaceCheckoutError("CART_NOT_FOUND", "Cart is unavailable.");
    const replay = await replayOrConflict(repository, cart.id, input.mutation); if (replay) return replay;
    mutableCart(cart, input.owner, input.mutation.expectedVersion);
    const fingerprint = cartLineFingerprint({ offerReference: input.selection.offerReference, variantReference: input.selection.variantReference, modifiers: input.selection.modifiers.map((item) => ({ groupReference: item.groupReference, optionReference: item.optionReference, quantity: item.quantity })) });
    const matching = cart.lines.find((line) => line.fingerprint === fingerprint);
    if (!matching && cart.lines.length >= MAX_CART_LINES) throw new MarketplaceCheckoutError("CART_LINE_INVALID", "Cart line limit reached.");
    const stores = new Set(cart.lines.map((line) => line.storeId));
    if (!stores.has(input.selection.storeId) && stores.size >= MAX_CART_STORES) throw new MarketplaceCheckoutError("CART_LINE_INVALID", "Cart store limit reached.");
    const lines = matching ? cart.lines.map((line) => line.fingerprint === fingerprint ? { ...line, quantity: line.quantity + input.selection.quantity } : line) : [...cart.lines, { publicReference: `line_${fingerprint.slice(0, 24)}`, storeId: input.selection.storeId, quantity: input.selection.quantity, fingerprint, selection: input.selection }];
    if (lines.some((line) => line.quantity > 99)) throw new MarketplaceCheckoutError("CART_LINE_INVALID", "Quantity limit reached.");
    return commit(repository, { ...cart, lines, version: cart.version + 1 }, input.mutation);
  });
}

export async function updateCartLineQuantity(repository: MarketplaceCartMutationRepository, input: Readonly<{ cartId: string; lineReference: string; owner: CartOwner; mutation: CartMutation; quantity: number; revalidate: (line: MarketplaceCartLineState, quantity: number) => Promise<CartLineSelection> }>): Promise<CartOperationResult> {
  assertSupportedQuantity(input.quantity);
  return repository.transaction(async () => {
    const cart = await repository.lockCart(input.cartId); if (!cart) throw new MarketplaceCheckoutError("CART_NOT_FOUND", "Cart is unavailable.");
    const replay = await replayOrConflict(repository, cart.id, input.mutation); if (replay) return replay;
    mutableCart(cart, input.owner, input.mutation.expectedVersion);
    const existing = cart.lines.find((line) => line.publicReference === input.lineReference); if (!existing) throw new MarketplaceCheckoutError("CART_LINE_INVALID", "Cart line is unavailable.");
    const selection = await input.revalidate(existing, input.quantity);
    const fingerprint = cartLineFingerprint({ offerReference: selection.offerReference, variantReference: selection.variantReference, modifiers: selection.modifiers.map((item) => ({ groupReference: item.groupReference, optionReference: item.optionReference, quantity: item.quantity })) });
    return commit(repository, { ...cart, version: cart.version + 1, lines: cart.lines.map((line) => line.publicReference === input.lineReference ? { ...line, quantity: input.quantity, fingerprint, selection } : line) }, input.mutation);
  });
}

export async function replaceCartLineModifiers(repository: MarketplaceCartMutationRepository, input: Readonly<{ cartId: string; lineReference: string; owner: CartOwner; mutation: CartMutation; modifiers: readonly { groupReference: string; optionReference: string; quantity: number }[]; revalidate: (line: MarketplaceCartLineState, modifiers: readonly { groupReference: string; optionReference: string; quantity: number }[]) => Promise<CartLineSelection> }>): Promise<CartOperationResult> {
  return repository.transaction(async () => {
    const cart = await repository.lockCart(input.cartId); if (!cart) throw new MarketplaceCheckoutError("CART_NOT_FOUND", "Cart is unavailable.");
    const replay = await replayOrConflict(repository, cart.id, input.mutation); if (replay) return replay;
    mutableCart(cart, input.owner, input.mutation.expectedVersion);
    const existing = cart.lines.find((line) => line.publicReference === input.lineReference); if (!existing) throw new MarketplaceCheckoutError("CART_LINE_INVALID", "Cart line is unavailable.");
    const selection = await input.revalidate(existing, input.modifiers);
    const fingerprint = cartLineFingerprint({ offerReference: selection.offerReference, variantReference: selection.variantReference, modifiers: selection.modifiers.map((item) => ({ groupReference: item.groupReference, optionReference: item.optionReference, quantity: item.quantity })) });
    const collision = cart.lines.find((line) => line.publicReference !== existing.publicReference && line.fingerprint === fingerprint);
    const lines = collision ? cart.lines.filter((line) => line.publicReference !== existing.publicReference).map((line) => line.publicReference === collision.publicReference ? { ...line, quantity: line.quantity + existing.quantity } : line) : cart.lines.map((line) => line.publicReference === existing.publicReference ? { ...line, fingerprint, selection } : line);
    if (lines.some((line) => line.quantity > 99)) throw new MarketplaceCheckoutError("CART_LINE_INVALID", "Quantity limit reached.");
    return commit(repository, { ...cart, lines, version: cart.version + 1 }, input.mutation);
  });
}

export async function removeCartLine(repository: MarketplaceCartMutationRepository, input: Readonly<{ cartId: string; lineReference: string; owner: CartOwner; mutation: CartMutation }>): Promise<CartOperationResult> {
  return repository.transaction(async () => {
    const cart = await repository.lockCart(input.cartId); if (!cart) throw new MarketplaceCheckoutError("CART_NOT_FOUND", "Cart is unavailable.");
    const replay = await replayOrConflict(repository, cart.id, input.mutation); if (replay) return replay;
    mutableCart(cart, input.owner, input.mutation.expectedVersion);
    if (!cart.lines.some((line) => line.publicReference === input.lineReference)) throw new MarketplaceCheckoutError("CART_LINE_INVALID", "Cart line is unavailable.");
    return commit(repository, { ...cart, lines: cart.lines.filter((line) => line.publicReference !== input.lineReference), version: cart.version + 1 }, input.mutation);
  });
}

export async function clearCart(repository: MarketplaceCartMutationRepository, input: Readonly<{ cartId: string; owner: CartOwner; mutation: CartMutation }>): Promise<CartOperationResult> {
  return repository.transaction(async () => {
    const cart = await repository.lockCart(input.cartId); if (!cart) throw new MarketplaceCheckoutError("CART_NOT_FOUND", "Cart is unavailable.");
    const replay = await replayOrConflict(repository, cart.id, input.mutation); if (replay) return replay;
    mutableCart(cart, input.owner, input.mutation.expectedVersion);
    return commit(repository, { ...cart, lines: [], version: cart.version + 1 }, input.mutation);
  });
}

export type MarketplaceCartMergeRepository = MarketplaceCartMutationRepository & Readonly<{
  lockCartByOwner(owner: CartOwner): Promise<MarketplaceCartState | null>;
  markMerged(guestCartId: string, customerCartId: string): Promise<void>;
}>;

export async function claimGuestCart(repository: MarketplaceCartMergeRepository, input: Readonly<{ guestOwner: Extract<CartOwner, { type: "GUEST" }>; customerOwner: Extract<CartOwner, { type: "CUSTOMER" }>; mutation: CartMutation }>): Promise<CartOperationResult> {
  return repository.transaction(async () => {
    const guest = await repository.lockCartByOwner(input.guestOwner); if (!guest) throw new MarketplaceCheckoutError("CART_ACCESS_DENIED", "Guest cart is unavailable.");
    const replay = await replayOrConflict(repository, guest.id, input.mutation); if (replay) return replay;
    if (["EXPIRED", "CONVERTED", "MERGED"].includes(guest.status)) throw new MarketplaceCheckoutError("CART_MUTATION_NOT_ALLOWED", "Guest cart cannot be claimed.");
    const customer = await repository.lockCartByOwner(input.customerOwner);
    if (customer) return mergeGuestAndCustomerCarts(repository, { guestCart: guest, customerCart: customer, mutation: input.mutation, customerOwner: input.customerOwner, revalidate: async (line) => line.selection });
    const claimed: MarketplaceCartState = { ...guest, owner: input.customerOwner, version: guest.version + 1 };
    return commit(repository, claimed, input.mutation);
  });
}

export async function mergeGuestAndCustomerCarts(repository: MarketplaceCartMergeRepository, input: Readonly<{ guestCart: MarketplaceCartState; customerCart: MarketplaceCartState; customerOwner: Extract<CartOwner, { type: "CUSTOMER" }>; mutation: CartMutation; revalidate: (line: MarketplaceCartLineState) => Promise<CartLineSelection> }>): Promise<CartOperationResult> {
  const guest = input.guestCart; const customer = input.customerCart;
  if (["EXPIRED", "CONVERTED", "MERGED"].includes(guest.status)) throw new MarketplaceCheckoutError("CART_MUTATION_NOT_ALLOWED", "Guest cart cannot be merged.");
  mutableCart(customer, input.customerOwner, customer.version);
  const conflicts: string[] = []; const candidates: MarketplaceCartLineState[] = [...customer.lines];
  for (const guestLine of guest.lines) {
    try {
      const selection = await input.revalidate(guestLine);
      const fingerprint = cartLineFingerprint({ offerReference: selection.offerReference, variantReference: selection.variantReference, modifiers: selection.modifiers.map((item) => ({ groupReference: item.groupReference, optionReference: item.optionReference, quantity: item.quantity })) });
      const duplicate = candidates.find((line) => line.fingerprint === fingerprint);
      if (duplicate) {
        const quantity = duplicate.quantity + guestLine.quantity;
        const dup: any = duplicate;
        if (quantity > 99) { dup.quantity = 99; conflicts.push(`QUANTITY_CAPPED:${guestLine.publicReference}`); } else dup.quantity = quantity;
      } else if (candidates.length >= MAX_CART_LINES || (!new Set(candidates.map((line) => line.storeId)).has(guestLine.storeId) && new Set(candidates.map((line) => line.storeId)).size >= MAX_CART_STORES)) conflicts.push(`CART_LIMIT:${guestLine.publicReference}`);
      else candidates.push({ ...guestLine, fingerprint, selection });
    } catch { conflicts.push(`UNAVAILABLE:${guestLine.publicReference}`); }
  }
  const merged: MarketplaceCartState = { ...customer, lines: candidates, version: customer.version + 1 };
  await repository.markMerged(guest.id, customer.id);
  return commit(repository, merged, input.mutation, conflicts);
}
