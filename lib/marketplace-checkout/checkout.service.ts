/* eslint-disable @typescript-eslint/no-explicit-any -- Phase 20 delegates remain dynamic until Prisma generation is permitted in Phase 26.5. */
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db/prisma";
import { MarketplaceCheckoutError } from "@/lib/marketplace-checkout/errors";
import { assertCheckoutTotals, canonicalMarketplaceFingerprint, CHECKOUT_LIVE_STATUSES, parseZarToCents, centsToZar } from "@/lib/marketplace-checkout/policy";
import { assertMarketplaceCheckoutProductionReady } from "@/lib/marketplace-checkout/production-lock";
import { resolveMarketplaceCheckoutProductionComposition } from "@/lib/marketplace-checkout/composition-root";
import { createPrismaMarketplacePaymentPreparationRepository } from "@/lib/marketplace-checkout/prisma-marketplace-payment-preparation.repository";
import { createPhase10And11MarketplacePaymentOrchestrator, prepareMarketplaceCheckoutPayment } from "@/lib/marketplace-checkout/marketplace-payment-preparation.service";
import { createPrismaMarketplaceReservationRepository } from "@/lib/marketplace-checkout/prisma-marketplace-reservation.repository";
import { releaseMarketplaceCheckoutReservation, reserveMarketplaceCheckoutInventory } from "@/lib/marketplace-checkout/inventory-reservation.service";
import type { CartOwner } from "@/lib/marketplace-checkout/cart.service";
import { ownerWhere, resolveMarketplaceCartLine } from "@/lib/marketplace-checkout/cart.service";

type Delegate = { findFirst: (args: unknown) => Promise<any>; findUnique: (args: unknown) => Promise<any>; create: (args: unknown) => Promise<any>; update: (args: unknown) => Promise<any> };
type Database = Record<string, Delegate>;
const database = prisma as unknown as Database;
const ref = (prefix: string) => `${prefix}_${randomUUID().replaceAll("-", "")}`;
function table(name: string, db = database): Delegate { const value = db[name]; if (!value) throw new MarketplaceCheckoutError("CHECKOUT_NOT_FOUND", "Marketplace checkout schema is not available in this runtime."); return value; }

export type CheckoutOwner = CartOwner;
export type CheckoutOperation = { operationId: string; requestHash: string; expectedVersion: number };

export async function getMarketplaceCheckoutForOwner(reference: string, owner: CheckoutOwner, db = database): Promise<any> {
  const checkout = await table("marketplaceCheckout", db).findFirst({ where: { publicReference: reference, ...(owner.type === "CUSTOMER" ? { customerUserId: owner.userId } : { guestAccessTokenHash: owner.guestTokenHash }) }, include: { storeGroups: { include: { lines: { include: { modifiers: true } } } }, changes: true } });
  if (!checkout) throw new MarketplaceCheckoutError("CHECKOUT_ACCESS_DENIED", "Checkout is unavailable.");
  return checkout;
}

function addCents(left: string, right: string): string {
  let carry = 0; let result = ""; let i = left.length - 1; let j = right.length - 1;
  while (i >= 0 || j >= 0 || carry) { const n = (i >= 0 ? Number(left[i--]) : 0) + (j >= 0 ? Number(right[j--]) : 0) + carry; result = `${n % 10}${result}`; carry = Math.floor(n / 10); }
  return result.replace(/^0+(?=\d)/, "");
}
function lineTotal(unit: string, quantity: number): string {
  let total = "0"; const cents = parseZarToCents(unit);
  for (let index = 0; index < quantity; index += 1) total = addCents(total, cents);
  return centsToZar(total);
}

export async function createMarketplaceCheckout(input: { cartReference: string; owner: CheckoutOwner }, db = database): Promise<any> {
  const carts = table("marketplaceCart", db); const checkouts = table("marketplaceCheckout", db);
  const cart = await carts.findFirst({ where: { publicReference: input.cartReference, ...ownerWhere(input.owner) }, include: { storeGroups: { include: { lines: { include: { modifiers: true } } } } } });
  if (!cart) throw new MarketplaceCheckoutError("CART_ACCESS_DENIED", "Cart is unavailable.");
  if (cart.status !== "ACTIVE") throw new MarketplaceCheckoutError("CART_MUTATION_NOT_ALLOWED", "Cart cannot start checkout.");
  if (!cart.storeGroups.length) throw new MarketplaceCheckoutError("CART_LINE_INVALID", "Cart is empty.");
  const existing = await checkouts.findFirst({ where: { cartId: cart.id, status: { in: [...CHECKOUT_LIVE_STATUSES] } } });
  if (existing) return existing;
  const groups: any[] = []; let merchandise = "0"; let modifiers = "0";
  for (const cartGroup of cart.storeGroups) {
    const snapshots: any[] = [];
    for (const cartLine of cartGroup.lines) {
      const source = await resolveMarketplaceCartLine({ offerReference: cartLine.offerPublicReference, variantReference: cartLine.variantPublicReference, quantity: cartLine.quantity, modifiers: cartLine.modifiers.map((modifier: any) => ({ groupReference: modifier.modifierGroupPublicReference, optionReference: modifier.modifierOptionPublicReference, quantity: modifier.quantity })) });
      const modifierUnit = source.modifiers.reduce((sum, modifier) => addCents(sum, parseZarToCents(modifier.priceDelta)), "0");
      const modifierUnitZar = centsToZar(modifierUnit); const effective = centsToZar(addCents(parseZarToCents(source.unitPrice), modifierUnit));
      const baseLine = lineTotal(source.unitPrice, source.quantity); const modifierLine = lineTotal(modifierUnitZar, source.quantity); const total = lineTotal(effective, source.quantity);
      merchandise = addCents(merchandise, parseZarToCents(baseLine)); modifiers = addCents(modifiers, parseZarToCents(modifierLine));
      snapshots.push({ productReference: source.productReference, variantReference: source.variantReference, offerReference: source.offerReference, storeReference: cartGroup.storeId, productTitle: source.productReference, variantTitle: source.variantReference, quantity: source.quantity, sellingUnit: "EACH", publicationVersion: source.publicationVersion, priceVersion: source.priceVersion, baseUnitPrice: source.unitPrice, modifierUnitTotal: modifierUnitZar, effectiveUnitPrice: effective, lineTotal: total, currency: "ZAR", taxTreatment: "SOURCE_PRICE_INCLUDES_TAX", modifiers: { create: source.modifiers.map((modifier) => ({ groupReference: modifier.groupReference, groupName: modifier.groupReference, optionReference: modifier.optionReference, optionName: modifier.optionReference, quantity: modifier.quantity, priceDelta: modifier.priceDelta, totalContribution: lineTotal(modifier.priceDelta, modifier.quantity), sourceVersion: "phase18" })) } });
    }
    groups.push({ storeId: cartGroup.storeId, fulfilmentMode: cartGroup.fulfilmentMode, merchandiseSubtotal: centsToZar(snapshots.reduce((sum, item) => addCents(sum, parseZarToCents(lineTotal(item.baseUnitPrice, item.quantity))), "0")), modifierSubtotal: centsToZar(snapshots.reduce((sum, item) => addCents(sum, parseZarToCents(lineTotal(item.modifierUnitTotal, item.quantity))), "0")), deliveryFee: "0.00", groupTotal: centsToZar(snapshots.reduce((sum, item) => addCents(sum, parseZarToCents(item.lineTotal)), "0")), status: "QUOTE_EXPIRED", lines: { create: snapshots } });
  }
  const merchandiseSubtotal = centsToZar(merchandise); const modifierSubtotal = centsToZar(modifiers); const grandTotal = centsToZar(addCents(merchandise, modifiers));
  assertCheckoutTotals({ merchandiseSubtotal, modifierSubtotal, deliveryFeeTotal: "0.00", grandTotal });
  const commercialFingerprint = canonicalMarketplaceFingerprint({ cartReference: cart.publicReference, ownerType: input.owner.type, groups: groups.map((group) => ({ storeId: group.storeId, lines: group.lines.create.map((line: any) => ({ offerReference: line.offerReference, variantReference: line.variantReference, quantity: line.quantity, priceVersion: line.priceVersion, modifierUnitTotal: line.modifierUnitTotal })) })), reservationPolicyVersion: "phase20-v1", currency: "ZAR" });
  const checkout = await checkouts.create({ data: { publicReference: ref("checkout"), cartId: cart.id, customerUserId: input.owner.type === "CUSTOMER" ? input.owner.userId : null, guestAccessTokenHash: input.owner.type === "GUEST" ? input.owner.guestTokenHash : null, status: "CHANGES_REQUIRED", currency: "ZAR", merchandiseSubtotal, modifierSubtotal, deliveryFeeTotal: "0.00", grandTotal, commercialFingerprint, storeGroups: { create: groups } }, include: { storeGroups: { include: { lines: { include: { modifiers: true } } } } } });
  await carts.update({ where: { id: cart.id }, data: { status: "CHECKOUT_LOCKED", version: { increment: 1 } } });
  return checkout;
}

export async function updateMarketplaceCheckoutContact(input: { reference: string; owner: CheckoutOwner; operation: CheckoutOperation; contact: { recipientName: string; email: string; phone: string; preferredContactMethod?: string } }, db = database): Promise<any> {
  validateContact(input.contact); return updateCheckoutSnapshot(input, "contact", db);
}

export async function updateMarketplaceCheckoutAddress(input: { reference: string; owner: CheckoutOwner; operation: CheckoutOperation; address: { recipientName: string; line1: string; line2?: string; suburb?: string; city: string; province: string; postalCode?: string; deliveryInstructions?: string; serviceAreaReference?: string } }, db = database): Promise<any> {
  validateAddress(input.address); return updateCheckoutSnapshot(input, "address", db);
}

async function updateCheckoutSnapshot(input: any, kind: "contact" | "address", db: Database): Promise<any> {
  const checkouts = table("marketplaceCheckout", db); const snapshots = table(kind === "contact" ? "marketplaceCheckoutContactSnapshot" : "marketplaceCheckoutAddressSnapshot", db);
  const checkout = await checkouts.findFirst({ where: { publicReference: input.reference, ...(input.owner.type === "CUSTOMER" ? { customerUserId: input.owner.userId } : { guestAccessTokenHash: input.owner.guestTokenHash }) } });
  if (!checkout) throw new MarketplaceCheckoutError("CHECKOUT_ACCESS_DENIED", "Checkout is unavailable.");
  if (checkout.version !== input.operation.expectedVersion) throw new MarketplaceCheckoutError("CHECKOUT_VERSION_CONFLICT", "Checkout changed. Refresh and try again.");
  if (["PAYMENT_PENDING", "PAYMENT_CONFIRMED", "COMPLETING", "COMPLETED"].includes(checkout.status)) throw new MarketplaceCheckoutError("CHECKOUT_REVIEW_REQUIRED", "Checkout contact and address are immutable at this stage.");
  const snapshot = await snapshots.create({ data: kind === "contact" ? input.contact : { ...input.address, country: "South Africa", protectedCoordinates: null } });
  const updated = await checkouts.update({ where: { id: checkout.id }, data: { [kind === "contact" ? "contactSnapshotId" : "addressSnapshotId"]: snapshot.id, status: "VALIDATING", reviewAcceptedAt: null, changesAcknowledgedAt: null, version: { increment: 1 } } });
  return { publicReference: updated.publicReference, version: updated.version, status: updated.status };
}

export async function beginMarketplaceReservation(input: { reference: string; owner: CheckoutOwner; expectedVersion: number; operationId: string; testApproval?: { approved: true } }) {
  resolveMarketplaceCheckoutProductionComposition();
  const checkout = await table("marketplaceCheckout").findFirst({ where: { publicReference: input.reference, ...(input.owner.type === "CUSTOMER" ? { customerUserId: input.owner.userId } : { guestAccessTokenHash: input.owner.guestTokenHash }) }, include: { storeGroups: { include: { lines: true } } } });
  if (!checkout || checkout.version !== input.expectedVersion || !checkout.acceptedFingerprint) throw new MarketplaceCheckoutError("CHECKOUT_REVIEW_REQUIRED", "A current accepted checkout review is required before inventory reservation.");
  const snapshots = checkout.storeGroups.flatMap((group: any) => group.lines);
  const lines = await Promise.all(snapshots.map(async (line: any) => {
    const item = await (prisma as any).catalogInventoryItem.findFirst({ where: { offer: { publicReference: line.offerReference } }, include: { levels: { where: { available: { gte: line.quantity } }, orderBy: { id: "asc" }, take: 1 }, offer: true } });
    const level = item?.levels[0];
    if (!item || !level) throw new MarketplaceCheckoutError("CHECKOUT_REVIEW_REQUIRED", "Canonical inventory evidence is unavailable for this checkout line.");
    return { lineReference: line.id, inventoryLevelId: level.id, inventoryItemReference: item.publicReference, locationReference: level.locationId, quantity: line.quantity };
  }));
  assertMarketplaceCheckoutProductionReady("RESERVATION", input.testApproval);
  return reserveMarketplaceCheckoutInventory(createPrismaMarketplaceReservationRepository(), { checkoutId: checkout.id, publicReference: ref("reservation"), commercialFingerprint: checkout.acceptedFingerprint, lines, expiresAt: new Date(Date.now() + 15 * 60_000), operationId: input.operationId });
}

export async function prepareMarketplacePayment(input: { reference: string; owner: CheckoutOwner; expectedVersion: number; operationId: string; testApproval?: { approved: true } }) {
  resolveMarketplaceCheckoutProductionComposition();
  const checkout = await table("marketplaceCheckout").findFirst({ where: { publicReference: input.reference, ...(input.owner.type === "CUSTOMER" ? { customerUserId: input.owner.userId } : { guestAccessTokenHash: input.owner.guestTokenHash }) }, include: { contactSnapshot: true } });
  if (!checkout || checkout.version !== input.expectedVersion || !checkout.contactSnapshot?.email) throw new MarketplaceCheckoutError("CHECKOUT_REVIEW_REQUIRED", "Canonical checkout payer contact evidence is required.");
  return prepareMarketplaceCheckoutPayment(createPrismaMarketplacePaymentPreparationRepository(), createPhase10And11MarketplacePaymentOrchestrator(), { checkoutReference: input.reference, payerEmail: checkout.contactSnapshot.email, operationId: input.operationId, testApproval: input.testApproval });
}

export async function cancelMarketplaceCheckout(input: { reference: string; owner: CheckoutOwner; operationId: string; testApproval?: { approved: true } }) {
  resolveMarketplaceCheckoutProductionComposition();
  const checkout = await table("marketplaceCheckout").findFirst({ where: { publicReference: input.reference, ...(input.owner.type === "CUSTOMER" ? { customerUserId: input.owner.userId } : { guestAccessTokenHash: input.owner.guestTokenHash }) }, include: { payment: true } });
  if (!checkout) throw new MarketplaceCheckoutError("CHECKOUT_ACCESS_DENIED", "Checkout is unavailable.");
  const repository = createPrismaMarketplaceReservationRepository();
  const reservation = await repository.findActiveReservation(checkout.id);
  assertMarketplaceCheckoutProductionReady("CANCELLATION", input.testApproval);
  if (!reservation) return Object.freeze({ released: false, status: checkout.status });
  const paymentStatus = checkout.payment?.status ?? null;
  const paymentOutcomeKnown = !paymentStatus || ["FAILED", "CANCELLED", "EXPIRED"].includes(paymentStatus);
  const released = await releaseMarketplaceCheckoutReservation(repository, { reservation, operationId: input.operationId, reason: "CHECKOUT_CANCELLED", paymentStatus, paymentOutcomeKnown });
  return Object.freeze({ released: true, status: released.status });
}

export async function finaliseAuthoritativelyConfirmedMarketplaceCheckout(input: { checkoutId: string; paymentId: string; testApproval?: { approved: true } }): Promise<never> {
  resolveMarketplaceCheckoutProductionComposition();
  assertMarketplaceCheckoutProductionReady("ORDER_FINALIZATION", input.testApproval);
  throw new MarketplaceCheckoutError("CHECKOUT_REVIEW_REQUIRED", "Finalization must be entered through the verified Phase 12 payment hook.");
}

function validateContact(contact: { recipientName: string; email: string; phone: string }): void {
  if (contact.recipientName.trim().length < 2 || contact.recipientName.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email) || contact.phone.replace(/\D/g, "").length < 8) throw new MarketplaceCheckoutError("CHECKOUT_REVIEW_REQUIRED", "Contact details are invalid.");
}
function validateAddress(address: { recipientName: string; line1: string; city: string; province: string; deliveryInstructions?: string }): void {
  if (!address.recipientName.trim() || !address.line1.trim() || !address.city.trim() || !address.province.trim() || (address.deliveryInstructions?.length ?? 0) > 500) throw new MarketplaceCheckoutError("CHECKOUT_REVIEW_REQUIRED", "Delivery address is invalid.");
}
