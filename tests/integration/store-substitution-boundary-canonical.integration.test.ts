import { createHash, randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { postCatalogInventoryMovement } from "@/lib/services/catalog-inventory.service";
import { prepareStoreOrder, storeControl } from "../e2e/fixtures/store-order";
import { withCanonicalBrowser } from "./marketplace-canonical-support";
import { applyMarketplaceStoreOrderAdjustment, confirmStoreOrderLineAvailability, decideStoreOrderSubstitution, expireStoreOrderSubstitutions, proposeStoreOrderSubstitution, updateStoreOrderSubstitutionPreference } from "@/lib/store-orders/store-order.service";

describe("canonical replacement price, expiry and zero-value boundaries", () => {
  for (const boundary of ["equal", "stale", "expiry"] as const) it(`persists ${boundary} replacement decisions without extra money or stranded stock`, () => withCanonicalBrowser(async page => {
    const f = await prepareStoreOrder(page, `pg-substitution-${boundary}`, 390);
    const owner = await prisma.user.findUniqueOrThrow({ where: { email: "e2e-store@ktcouriers.local" } });
    const customer = await prisma.user.findUniqueOrThrow({ where: { email: `e2e-paystack-pg-substitution-${boundary}@ktcouriers.local` } });
    const original = await prisma.storeCatalogOffer.findUniqueOrThrow({ where: { publicReference: "CO-E2E64GB" } });
    const location = await prisma.inventoryLocation.findFirstOrThrow({ where: { storeId: original.storeId, status: "ACTIVE" }, orderBy: { id: "asc" } });
    const tag = randomUUID();
    // Synthetic catalog input facts only. Captured payment and settled order above
    // came from signed ingress, independent Verify and canonical consumers.
    const offer = await prisma.storeCatalogOffer.create({ data: { publicReference: `CO-SUB-${tag}`, storeId: original.storeId, productId: original.productId, variantId: original.variantId, storeSku: `sub-${tag}`, status: "DRAFT", publicationStatus: "DRAFT", inventoryTrackingMode: "TRACKED", fulfilmentMode: "COURIER_DELIVERY", sellingUnit: "EACH", createdByUserId: owner.id } });
    const price = await prisma.storeOfferPriceVersion.create({ data: { publicReference: `CPR-SUB-${tag}`, offerId: offer.id, versionNumber: 1, amount: "1500.00", currency: "ZAR", priceIncludesTax: true, effectiveFrom: new Date("2026-01-01"), status: "ACTIVE", createdByUserId: owner.id } });
    await prisma.storeCatalogOffer.update({ where: { id: offer.id }, data: { currentPriceVersionId: price.id, status: "ACTIVE", publicationStatus: "PUBLISHED", primaryInventoryLocationId: location.id } });
    const item = await prisma.catalogInventoryItem.create({ data: { publicReference: `CII-SUB-${tag}`, offerId: offer.id, variantId: original.variantId, trackingMode: "TRACKED" } });
    await postCatalogInventoryMovement(original.storeId, owner.id, item.publicReference, { type: "STOCK_RECEIPT", quantityDelta: 3, locationPublicReference: location.publicReference, version: item.version, operationId: randomUUID(), reasonCode: "DISPOSABLE_REPLACEMENT_INPUT" });
    const level = () => prisma.catalogInventoryLevel.findUniqueOrThrow({ where: { inventoryItemId_locationId: { inventoryItemId: item.id, locationId: location.id } } });
    const command = () => { const operationId = randomUUID(); return { actorUserId: owner.id, storeOrderReference: f.storeReference, operationId, requestHash: createHash("sha256").update(operationId).digest("hex") }; };
    await updateStoreOrderSubstitutionPreference({ ...command(), orderLineId: f.baseline.lines[0].id, customerUserId: customer.id, preference: "CONTACT_ME" });
    const unavailable = await confirmStoreOrderLineAvailability({ ...command(), orderLineId: f.baseline.lines[0].id, availableQuantity: 0 });
    if (!("issueReference" in unavailable) || typeof unavailable.issueReference !== "string") throw Error("Owned issue reference required.");
    const proposed = await proposeStoreOrderSubstitution({ ...command(), issueReference: unavailable.issueReference, substituteOfferReference: offer.publicReference, substituteVariantReference: "CV-E2E64GB", quantity: 1 });
    if (!("proposalReference" in proposed) || typeof proposed.proposalReference !== "string") throw Error("Owned proposal reference required.");
    expect(await level()).toMatchObject({ onHand: 3, reserved: 1, available: 2 });
    const decision = { ...command(), proposalReference: proposed.proposalReference, customerUserId: customer.id, decision: "APPROVE" as const };
    if (boundary === "equal") {
      const approved = await decideStoreOrderSubstitution(decision);
      expect(await decideStoreOrderSubstitution(decision)).toMatchObject({ replayed: true });
      if (!("adjustmentReference" in approved) || typeof approved.adjustmentReference !== "string") throw Error("Bound adjustment required.");
      const adjustment = await prisma.marketplaceStoreOrderAdjustment.findUniqueOrThrow({ where: { publicReference: approved.adjustmentReference }, include: { allocations: true } });
      expect(adjustment.refundAmount.isZero()).toBe(true); expect(adjustment.allocations).toHaveLength(3); expect(adjustment.allocations.every(row => row.amount.isZero())).toBe(true);
      const before = await storeControl(f.storeReference);
      const apply = { ...command(), adjustmentReference: adjustment.publicReference };
      expect(await applyMarketplaceStoreOrderAdjustment(apply)).toMatchObject({ financialStatus: "REFUND_COMPLETED" });
      expect(await applyMarketplaceStoreOrderAdjustment(apply)).toMatchObject({ replayed: true });
      const after = await storeControl(f.storeReference);
      expect(after.journalCount).toBe(before.journalCount); expect(after.payment).toEqual(f.baseline.payment); expect(after.resolutionStatus).toBe("RESOLVED");
      expect(after.adjustments[0].status).toBe("COMPLETED"); expect(after.proposals[0].reservation.status).toBe("CONSUMED");
      expect(await level()).toMatchObject({ onHand: 2, reserved: 0, available: 2 });
    } else {
      if (boundary === "stale") {
        // Immutable successor input simulates a vendor changing commercial facts.
        await prisma.$transaction(async tx => {
          await tx.storeOfferPriceVersion.update({ where: { id: price.id }, data: { status: "RETIRED", retiredAt: new Date() } });
          const successor = await tx.storeOfferPriceVersion.create({ data: { publicReference: `CPR-SUB2-${tag}`, offerId: offer.id, versionNumber: 2, amount: "1499.99", currency: "ZAR", priceIncludesTax: true, effectiveFrom: new Date(), status: "ACTIVE", createdByUserId: owner.id } });
          await tx.storeCatalogOffer.update({ where: { id: offer.id }, data: { currentPriceVersionId: successor.id, version: { increment: 1 } } });
        });
        const before = await storeControl(f.storeReference), held = await level();
        await expect(decideStoreOrderSubstitution(decision)).rejects.toMatchObject({ code: "STORE_ORDER_SUBSTITUTION_STALE" });
        expect(await storeControl(f.storeReference)).toEqual(before); expect(await level()).toEqual(held);
        await decideStoreOrderSubstitution({ ...command(), proposalReference: proposed.proposalReference, customerUserId: customer.id, decision: "REJECT_AND_REFUND" });
        expect((await storeControl(f.storeReference)).proposals[0]).toMatchObject({ status: "REJECTED", reservation: { status: "RELEASED" } });
      } else {
        const proposal = await prisma.marketplaceStoreOrderSubstitutionProposal.findUniqueOrThrow({ where: { publicReference: proposed.proposalReference } });
        const now = new Date(proposal.expiresAt.getTime() + 1);
        const expire = { now, operationIdFactory: (reference: string) => `expiry:${createHash("sha256").update(reference).digest("hex")}` };
        expect(await expireStoreOrderSubstitutions(expire)).toEqual(expect.arrayContaining([expect.objectContaining({ proposalReference: proposed.proposalReference, expired: true })]));
        const before = await storeControl(f.storeReference);
        await expireStoreOrderSubstitutions(expire); expect(await storeControl(f.storeReference)).toEqual(before);
        expect(before.proposals[0]).toMatchObject({ status: "EXPIRED", reservation: { status: "EXPIRED" } });
        await expect(decideStoreOrderSubstitution(decision)).rejects.toMatchObject({ code: "STORE_ORDER_SUBSTITUTION_INVALID" });
      }
      expect(await level()).toMatchObject({ onHand: 3, reserved: 0, available: 3 });
      const after = await storeControl(f.storeReference); expect(after.payment).toEqual(f.baseline.payment); expect(after.adjustments).toHaveLength(1); expect(after.adjustments[0].refundAmount).toBe("1500.00");
    }
    expect(await prisma.paymentRefund.count({ where: { paymentId: f.snapshot.payment.id } })).toBe(0);
    expect(await prisma.marketplaceStoreOrderCustomerDecision.count({ where: { proposal: { publicReference: proposed.proposalReference } } })).toBe(boundary === "expiry" ? 0 : 1);
  }), 180_000);
});
