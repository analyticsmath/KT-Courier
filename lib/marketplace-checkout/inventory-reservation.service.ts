import { MarketplaceCheckoutError } from "@/lib/marketplace-checkout/errors";
import { reservationReleaseAllowed } from "@/lib/marketplace-checkout/policy";

export type ReservationLine = Readonly<{ lineReference: string; inventoryLevelId: string; inventoryItemReference: string; locationReference: string; quantity: number }>;
export type InventoryLevelState = Readonly<{ id: string; onHand: number; reserved: number; available: number }>;
export type MarketplaceReservationState = Readonly<{ id: string; checkoutId: string; status: "ACTIVE" | "PAYMENT_PENDING_HOLD" | "PAYMENT_UNCERTAIN" | "CONSUMED" | "RELEASED" | "EXPIRED" | "RECONCILIATION_REQUIRED"; commercialFingerprint: string; expiresAt: Date; items: readonly ReservationLine[]; paymentId?: string | null }>;
export type MarketplaceReservationRepository = Readonly<{
  transaction<T>(work: () => Promise<T>): Promise<T>;
  lockCheckout(checkoutId: string): Promise<{ id: string; status: string; acceptedFingerprint: string | null; reviewAcceptedAt: Date | null } | null>;
  lockLevelsInStableOrder(levelIds: readonly string[]): Promise<readonly InventoryLevelState[]>;
  findActiveReservation(checkoutId: string): Promise<MarketplaceReservationState | null>;
  createReservation(input: MarketplaceReservationState): Promise<MarketplaceReservationState>;
  updateReservation(id: string, patch: Partial<MarketplaceReservationState>): Promise<MarketplaceReservationState>;
  applyLevelReservation(levelId: string, quantityDelta: number): Promise<void>;
  applyLevelCommitment(levelId: string, quantity: number): Promise<void>;
  appendMovement(input: Readonly<{ inventoryItemReference: string; locationReference: string; levelId: string; type: "RESERVATION" | "RESERVATION_RELEASE" | "SALE_COMMITMENT"; quantityDelta: number; operationId: string; reasonCode: string }>): Promise<void>;
  updateCheckout(checkoutId: string, patch: Readonly<{ status: string; reservationExpiresAt?: Date | null }>): Promise<void>;
  completeOperation?(input: Readonly<{ checkoutId: string; operationId: string; requestHash: string; type: "RESERVE" | "RELEASE_RESERVATION" | "CONSUME_RESERVATION"; response: Record<string, string> }>): Promise<void>;
}>;

function uniqueSorted(items: readonly ReservationLine[]): readonly ReservationLine[] {
  const seen = new Set<string>(); const result: ReservationLine[] = [];
  for (const item of [...items].sort((a, b) => a.inventoryLevelId.localeCompare(b.inventoryLevelId))) {
    if (!item.inventoryLevelId || item.quantity < 1 || seen.has(item.inventoryLevelId)) throw new MarketplaceCheckoutError("CHECKOUT_REVIEW_REQUIRED", "Checkout inventory evidence is invalid.");
    seen.add(item.inventoryLevelId); result.push(item);
  }
  return result;
}

export async function reserveMarketplaceCheckoutInventory(repository: MarketplaceReservationRepository, input: Readonly<{ checkoutId: string; publicReference: string; commercialFingerprint: string; lines: readonly ReservationLine[]; expiresAt: Date; operationId: string }>): Promise<MarketplaceReservationState> {
  return repository.transaction(async () => {
    const existing = await repository.findActiveReservation(input.checkoutId);
    if (existing) {
      if (existing.commercialFingerprint !== input.commercialFingerprint) throw new MarketplaceCheckoutError("CHECKOUT_OPERATION_CONFLICT", "Checkout reservation belongs to different commercial evidence.");
      return existing;
    }
    const checkout = await repository.lockCheckout(input.checkoutId);
    if (!checkout || checkout.status !== "READY_FOR_REVIEW" || !checkout.reviewAcceptedAt || checkout.acceptedFingerprint !== input.commercialFingerprint) throw new MarketplaceCheckoutError("CHECKOUT_REVIEW_REQUIRED", "An accepted current checkout review is required before inventory reservation.");
    const lines = uniqueSorted(input.lines); const levels = await repository.lockLevelsInStableOrder(lines.map((line) => line.inventoryLevelId));
    const byId = new Map(levels.map((level) => [level.id, level]));
    for (const line of lines) { const level = byId.get(line.inventoryLevelId); if (!level || level.available < line.quantity || level.reserved < 0 || level.onHand < line.quantity) throw new MarketplaceCheckoutError("CHECKOUT_REVIEW_REQUIRED", "Inventory is no longer available for this checkout."); }
    for (const line of lines) { await repository.applyLevelReservation(line.inventoryLevelId, line.quantity); await repository.appendMovement({ inventoryItemReference: line.inventoryItemReference, locationReference: line.locationReference, levelId: line.inventoryLevelId, type: "RESERVATION", quantityDelta: 0, operationId: `${input.operationId}:${line.inventoryLevelId}`, reasonCode: "MARKETPLACE_CHECKOUT_RESERVATION" }); }
    const reservation = await repository.createReservation({ id: input.publicReference, checkoutId: input.checkoutId, status: "ACTIVE", commercialFingerprint: input.commercialFingerprint, expiresAt: input.expiresAt, items: lines });
    await repository.updateCheckout(input.checkoutId, { status: "RESERVED", reservationExpiresAt: input.expiresAt });
    await repository.completeOperation?.({ checkoutId: input.checkoutId, operationId: input.operationId, requestHash: input.commercialFingerprint, type: "RESERVE", response: { reservationId: reservation.id, status: reservation.status } });
    return reservation;
  });
}

export async function releaseMarketplaceCheckoutReservation(repository: MarketplaceReservationRepository, input: Readonly<{ reservation: MarketplaceReservationState; operationId: string; reason: "CHECKOUT_CANCELLED" | "CHECKOUT_EXPIRED" | "PAYMENT_DEFINITELY_FAILED" | "REPRICE_REQUIRED" | "ADMIN_RECONCILIATION"; paymentStatus?: string | null; paymentOutcomeKnown: boolean }>): Promise<MarketplaceReservationState> {
  return repository.transaction(async () => {
    if (input.reservation.status === "RELEASED" || input.reservation.status === "EXPIRED") return input.reservation;
    if (!reservationReleaseAllowed({ reservationStatus: input.reservation.status, paymentStatus: input.paymentStatus, paymentOutcomeKnown: input.paymentOutcomeKnown })) throw new MarketplaceCheckoutError("CHECKOUT_REVIEW_REQUIRED", "Reservation cannot be released while payment outcome is uncertain.");
    const items = uniqueSorted(input.reservation.items); await repository.lockLevelsInStableOrder(items.map((item) => item.inventoryLevelId));
    for (const item of items) { await repository.applyLevelReservation(item.inventoryLevelId, -item.quantity); await repository.appendMovement({ inventoryItemReference: item.inventoryItemReference, locationReference: item.locationReference, levelId: item.inventoryLevelId, type: "RESERVATION_RELEASE", quantityDelta: 0, operationId: `${input.operationId}:${item.inventoryLevelId}`, reasonCode: input.reason }); }
    const status = input.reason === "CHECKOUT_EXPIRED" ? "EXPIRED" : "RELEASED";
    const reservation = await repository.updateReservation(input.reservation.id, { status, paymentId: input.reservation.paymentId ?? null });
    await repository.updateCheckout(input.reservation.checkoutId, { status: status === "EXPIRED" ? "EXPIRED" : "CANCELLED", reservationExpiresAt: null });
    await repository.completeOperation?.({ checkoutId: input.reservation.checkoutId, operationId: input.operationId, requestHash: input.reservation.commercialFingerprint, type: "RELEASE_RESERVATION", response: { reservationId: reservation.id, status: reservation.status } });
    return reservation;
  });
}

export async function expireMarketplaceCheckoutReservation(repository: MarketplaceReservationRepository, reservation: MarketplaceReservationState, now: Date, operationId: string): Promise<MarketplaceReservationState | null> {
  if (reservation.expiresAt > now || ["PAYMENT_PENDING_HOLD", "PAYMENT_UNCERTAIN"].includes(reservation.status)) return null;
  return releaseMarketplaceCheckoutReservation(repository, { reservation, operationId, reason: "CHECKOUT_EXPIRED", paymentOutcomeKnown: true, paymentStatus: null });
}

export async function holdReservationForUncertainPayment(repository: MarketplaceReservationRepository, reservation: MarketplaceReservationState, paymentId: string): Promise<MarketplaceReservationState> {
  if (!["ACTIVE", "PAYMENT_PENDING_HOLD"].includes(reservation.status)) throw new MarketplaceCheckoutError("CHECKOUT_REVIEW_REQUIRED", "Reservation is not eligible for payment hold.");
  return repository.transaction(async () => repository.updateReservation(reservation.id, { status: "PAYMENT_UNCERTAIN", paymentId }));
}

export async function consumeMarketplaceCheckoutReservation(repository: MarketplaceReservationRepository, input: Readonly<{ reservation: MarketplaceReservationState; paymentId: string; operationId: string }>): Promise<MarketplaceReservationState> {
  return repository.transaction(async () => {
    if (input.reservation.status === "CONSUMED") return input.reservation;
    if (!["ACTIVE", "PAYMENT_PENDING_HOLD", "PAYMENT_UNCERTAIN"].includes(input.reservation.status)) throw new MarketplaceCheckoutError("CHECKOUT_REVIEW_REQUIRED", "Reservation cannot be consumed.");
    const items = uniqueSorted(input.reservation.items); await repository.lockLevelsInStableOrder(items.map((item) => item.inventoryLevelId));
    for (const item of items) { await repository.applyLevelCommitment(item.inventoryLevelId, item.quantity); await repository.appendMovement({ inventoryItemReference: item.inventoryItemReference, locationReference: item.locationReference, levelId: item.inventoryLevelId, type: "SALE_COMMITMENT", quantityDelta: -item.quantity, operationId: `${input.operationId}:${item.inventoryLevelId}`, reasonCode: "MARKETPLACE_ORDER_COMMITMENT" }); }
    const consumed = await repository.updateReservation(input.reservation.id, { status: "CONSUMED", paymentId: input.paymentId });
    await repository.completeOperation?.({ checkoutId: input.reservation.checkoutId, operationId: input.operationId, requestHash: input.reservation.commercialFingerprint, type: "CONSUME_RESERVATION", response: { reservationId: consumed.id, status: consumed.status } });
    return consumed;
  });
}
