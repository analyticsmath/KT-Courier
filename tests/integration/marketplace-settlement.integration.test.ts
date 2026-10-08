import { describe, expect, it } from "vitest";
import { prisma } from "../../lib/db/prisma";
import { withCanonicalBrowser } from "./marketplace-canonical-support";
import { prepareStoreOrder, storeControl } from "../e2e/fixtures/store-order";

describe("Phase 20 PostgreSQL marketplace settlement scenarios", () => {
  it("posts frozen commission and seller earning once from canonical paid source without payout", () => withCanonicalBrowser(async page => {
    const f = await prepareStoreOrder(page, "pg-residual-settlement", 390);
    const snapshot = await prisma.marketplaceSettlementSnapshot.findUniqueOrThrow({ where: { marketplaceStoreOrderId_settlementVersion: { marketplaceStoreOrderId: f.order.storeOrders[0].id, settlementVersion: "phase20-v1" } } });
    expect(snapshot.status).toBe("COMPLETED");
    expect(snapshot.sellerBasis.sub(snapshot.commissionAmount).equals(snapshot.storeEarningAmount)).toBe(true);
    expect(snapshot.commissionAccrualReference).toBeTruthy();
    expect(snapshot.storeEarningReference).toBeTruthy();
    expect(snapshot.sourcePaymentId).toBe(f.snapshot.payment.id);
    const before = await storeControl(f.storeReference);
    await storeControl(f.storeReference, "initialize");
    expect(await storeControl(f.storeReference)).toEqual(before);
    expect(await prisma.marketplaceSettlementSnapshot.findUniqueOrThrow({ where: { id: snapshot.id } })).toEqual(snapshot);
    const jobs = await prisma.marketplaceStoreSettlementJob.findMany({ where: { settlementSnapshotId: snapshot.id } });
    expect(jobs).toHaveLength(1); expect(jobs[0].status).toBe("COMPLETED");
  }), 180_000);
});
