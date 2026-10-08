import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/db/prisma";
import { withCanonicalBrowser, canonicalPaidBasket } from "./marketplace-canonical-support";
import { paymentControl } from "../e2e/fixtures/store-order";

describe("Phase 20 PostgreSQL marketplace order scenarios", () => {
  it("freezes separate stores, modifier quantities and commission versions from one verified payment", () => withCanonicalBrowser(async page => {
    const f = await canonicalPaidBasket(page, "pg-residual-multistore", {
      baseLine: { offerReference: "CO-E2E64GB", variantReference: "CV-E2E64GB", quantity: 2, modifiers: [{ groupReference: "mod_warranty", optionReference: "opt_2yr", quantity: 1 }] },
      lines: [{ offerReference: "CO-RESIDUAL-three", variantReference: "CV-RESIDUAL-three", quantity: 1, modifiers: [] }],
    });
    const order = await prisma.marketplaceOrder.findUniqueOrThrow({ where: { id: f.paid.orders[0].id }, include: { storeOrders: { include: { lines: true, settlementSnapshots: true } } } });
    expect(order.storeOrders).toHaveLength(2);
    expect(new Set(order.storeOrders.map(row => row.storeId)).size).toBe(2);
    const snapshots = order.storeOrders.flatMap(row => row.settlementSnapshots);
    expect(snapshots).toHaveLength(2);
    expect(new Set(snapshots.map(row => row.commissionPlanReference)).size).toBe(2);
    expect(snapshots.every(row => row.status === "PENDING" && row.sellerBasis.sub(row.commissionAmount).equals(row.storeEarningAmount))).toBe(true);
    const basis = snapshots.reduce((sum, row) => sum.add(row.sellerBasis), new Prisma.Decimal(0));
    expect(basis.toFixed(2)).toBe("3500.03");
    const largeLine = order.storeOrders.flatMap(row => row.lines).find(line => line.quantity === 2)!;
    expect(largeLine).toBeDefined();
    expect(order.grandTotal.equals(basis.add(snapshots.reduce((sum, row) => sum.add(row.deliveryFeeResidual), new Prisma.Decimal(0))))).toBe(true);
    expect(f.paid.reservations.flatMap(row => row.items).reduce((sum, item) => sum + item.quantity, 0)).toBe(3);
    const replay = await paymentControl(f.reference, "process");
    expect(replay.orders).toEqual(f.paid.orders);
    expect(replay.journals).toEqual(f.paid.journals);
    expect(replay.reservations).toEqual(f.paid.reservations);
  }), 180_000);
});
