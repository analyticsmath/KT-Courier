import { describe, it, expect, beforeAll } from "vitest";
import { validateGate4DatabaseSafety } from "./harness-safety";
import { prisma } from "@/lib/db/prisma";

describe("Gate 4 — Final Global Transactional Invariant Scan Suite", () => {
  let safety: ReturnType<typeof validateGate4DatabaseSafety>;

  beforeAll(() => {
    safety = validateGate4DatabaseSafety();
  });

  it("SCAN-00: Non-vacuity verification — Gate 4 database is materially populated with test entities", async () => {
    if (!safety.ok) {
      console.warn(`[SKIP_DB_EXECUTION] ${safety.reason}`);
      return;
    }

    const orderCount = await prisma.order.count();
    const webhookCount = await prisma.paymentWebhookEvent.count();
    const journalCount = await prisma.ledgerJournal.count();
    const assignmentCount = await prisma.orderAssignment.count();

    expect(orderCount).toBeGreaterThan(0);
    expect(webhookCount).toBeGreaterThan(0);
    expect(journalCount).toBeGreaterThan(0);
    expect(assignmentCount).toBeGreaterThan(0);
  });

  it("SCAN-01: Zero unbalanced ledger journals (total debits = total credits for every journal)", async () => {
    if (!safety.ok) return;

    const journals = await prisma.ledgerJournal.findMany({
      include: { entries: true },
    });

    let unbalancedCount = 0;
    for (const journal of journals) {
      const debits = journal.entries.filter((e) => e.direction === "DEBIT").reduce((acc, e) => acc + Number(e.amount), 0);
      const credits = journal.entries.filter((e) => e.direction === "CREDIT").reduce((acc, e) => acc + Number(e.amount), 0);
      if (Math.abs(debits - credits) > 0.001) {
        unbalancedCount += 1;
      }
    }

    expect(unbalancedCount).toBe(0);
  });

  it("SCAN-02: Zero duplicate idempotency keys in ledger journals", async () => {
    if (!safety.ok) return;

    const duplicates = await prisma.ledgerJournal.groupBy({
      by: ["idempotencyKey"],
      having: { idempotencyKey: { _count: { gt: 1 } } },
    });

    expect(duplicates.length).toBe(0);
  });

  it("SCAN-03: Zero inventory levels with negative available or negative reserved stock", async () => {
    if (!safety.ok) return;

    const negativeAvailable = await prisma.catalogInventoryLevel.count({
      where: { OR: [{ available: { lt: 0 } }, { reserved: { lt: 0 } }, { onHand: { lt: 0 } }] },
    });

    expect(negativeAvailable).toBe(0);
  });

  it("SCAN-04: Zero orders with multiple active ACCEPTED order assignments", async () => {
    if (!safety.ok) return;

    const duplicateAssignments = await prisma.orderAssignment.groupBy({
      by: ["orderId"],
      where: { status: "ACCEPTED" },
      having: { orderId: { _count: { gt: 1 } } },
    });

    expect(duplicateAssignments.length).toBe(0);
  });

  it("SCAN-05: Zero wallets with negative available balances", async () => {
    if (!safety.ok) return;

    const negativeWallets = await prisma.wallet.count({
      where: { availableBalance: { lt: 0 } },
    });

    expect(negativeWallets).toBe(0);
  });

  it("SCAN-06: Zero duplicate driver earnings for the same driver creation idempotency key", async () => {
    if (!safety.ok) return;

    const duplicateEarnings = await prisma.driverEarning.groupBy({
      by: ["creationIdempotencyKey"],
      having: { creationIdempotencyKey: { _count: { gt: 1 } } },
    });

    expect(duplicateEarnings.length).toBe(0);
  });

  it("SCAN-07: Zero notification deliveries in DELIVERED status without valid messageId", async () => {
    if (!safety.ok) return;

    const orphanDeliveries = await prisma.notificationDelivery.count({
      where: { status: "DELIVERED", messageId: "" },
    });

    expect(orphanDeliveries).toBe(0);
  });
});

