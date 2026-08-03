import { CatalogConflictError, CatalogPolicyError } from "@/lib/catalog/errors";

export type InventoryProjection = { onHand: number; reserved: number; available: number };

export function inventoryProjection(onHand: number, reserved = 0): InventoryProjection {
  if (!Number.isSafeInteger(onHand) || !Number.isSafeInteger(reserved) || onHand < 0 || reserved < 0 || reserved > onHand) {
    throw new CatalogPolicyError("INVALID_INVENTORY_PROJECTION", "Tracked stock must be non-negative and reserved cannot exceed on-hand.");
  }
  return { onHand, reserved, available: onHand - reserved };
}

export function applyInventoryDelta(current: InventoryProjection, quantityDelta: number): InventoryProjection {
  if (!Number.isSafeInteger(quantityDelta) || quantityDelta === 0) {
    throw new CatalogPolicyError("INVALID_INVENTORY_DELTA", "Inventory movement must be a non-zero integer.");
  }
  const resulting = current.onHand + quantityDelta;
  if (resulting < current.reserved || resulting < 0) {
    throw new CatalogConflictError("NEGATIVE_INVENTORY", "Inventory movement would create negative available stock.");
  }
  return inventoryProjection(resulting, current.reserved);
}

export function assertPhase18ReservedInventory(reserved: number, fixture = false): void {
  if (reserved !== 0 && !fixture) {
    throw new CatalogPolicyError("RESERVATIONS_DEFERRED", "Customer inventory reservations are not available in Phase 18.");
  }
}

