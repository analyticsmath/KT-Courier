import { describe, it, expect, beforeAll } from "vitest";
import { validateGate4DatabaseSafety } from "./harness-safety";
import { runConcurrentRace } from "./barrier";
import { createGate4CapturedPaymentScenario, requireGate4Fixture } from "./fixtures";
import { createRefundRequest } from "@/lib/services/refund-request.service";
import { prisma } from "@/lib/db/prisma";
import { Prisma } from "@prisma/client";

describe("Gate 4 — Refund Concurrency and Ceiling Invariants Suite", () => {
  let safety: ReturnType<typeof validateGate4DatabaseSafety>;

  beforeAll(() => {
    safety = validateGate4DatabaseSafety();
  });

  it("G4-PAY-003 [Refund Ceiling Race]: Two concurrent $60 refunds on a $100 payment result in 1 success and 1 rejection", async () => {
    if (!safety.ok) {
      console.warn(`[SKIP_DB_EXECUTION] ${safety.reason}`);
      return;
    }

    const { customer, payment } = await createGate4CapturedPaymentScenario("refund-conc", "ceiling-race", { status: "SUCCEEDED", amount: "100.00" });
    requireGate4Fixture(payment, "Captured payment fixture required");

    const platformWallet = await prisma.wallet.upsert({
      where: {
        ownerType_ownerId_currency: {
          ownerType: "PLATFORM",
          ownerId: "platform",
          currency: "ZAR",
        },
      },
      update: {},
      create: {
        ownerType: "PLATFORM",
        ownerId: "platform",
        currency: "ZAR",
        status: "ACTIVE",
      },
    });

    await prisma.ledgerAccount.upsert({
      where: { code: "PLATFORM-CUSTOMER-FUNDS-HELD-ZAR" },
      update: {},
      create: {
        walletId: platformWallet.id,
        code: "PLATFORM-CUSTOMER-FUNDS-HELD-ZAR",
        purpose: "HELD",
        category: "LIABILITY",
        currency: "ZAR",
        allowNegative: false,
        currentBalance: new Prisma.Decimal("1000.00"),
      },
    });

    const results = await runConcurrentRace(2, async (_client, index, barrier) => {
      await barrier.wait();

      return createRefundRequest(
        {
          actorUserId: customer.id,
          paymentPublicReference: payment.publicReference,
          amount: "60.00",
          method: "CUSTOMER_WALLET",
          reasonCode: "CUSTOMER_SERVICE_RESOLUTION",
          operationId: `op_g4_rf_${index}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        },
        { assertProductionReady: () => {} }
      );
    });

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");

    if (fulfilled.length !== 1) {
      console.error("G4-PAY-003 test errors:", results);
    }

    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(1);
  });
});

