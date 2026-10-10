import { describe, expect, it } from "vitest";
import { createPrismaMarketplaceFinalizationRepository } from "@/lib/marketplace-checkout/prisma-marketplace-finalization.repository";
import { createPrismaMarketplaceReviewRepository, createPrismaMarketplaceAcknowledgementRepository } from "@/lib/marketplace-checkout/prisma-review-composition.repository";
import { createPrismaMarketplaceSettlementRepository } from "@/lib/marketplace-checkout/prisma-marketplace-settlement.repository";

describe("overlapping marketplace repository transactions", () => {
  it.each(["finalization", "review", "acknowledgement", "settlement"] as const)("keeps each %s operation on its own transaction when the adapter is reused", async kind => {
    let arrivals = 0;
    let release!: () => void;
    const barrier = new Promise<void>(resolve => { release = resolve; });
    const observed: string[] = [];
    const database = {
      $transaction: async <T>(work: (tx: object) => Promise<T>) => {
        const owner = `transaction-${++arrivals}`;
        if (arrivals === 2) release();
        const read = async () => { observed.push(owner); return null; };
        return work({ $queryRaw: async () => [], payment: { findUnique: read }, marketplaceCheckout: { findFirst: read }, marketplaceStoreOrder: { findUnique: read } });
      },
    };
    const repository = kind === "finalization" ? createPrismaMarketplaceFinalizationRepository(database) : kind === "review" ? createPrismaMarketplaceReviewRepository(database) : kind === "settlement" ? createPrismaMarketplaceSettlementRepository(database) : createPrismaMarketplaceAcknowledgementRepository(database);
    const read = async (id: string) => "lockVerifiedSuccessfulPayment" in repository ? repository.lockVerifiedSuccessfulPayment(id) : "lockCanonicalSettlement" in repository ? repository.lockCanonicalSettlement(id) : repository.lockCheckout(id, { type: "CUSTOMER", userId: "customer" });
    await Promise.all([repository.transaction(async () => { await barrier; await read("first"); }), repository.transaction(async () => { await barrier; await read("second"); })]);
    expect(observed.sort()).toEqual(["transaction-1", "transaction-2"]);
  });
});
