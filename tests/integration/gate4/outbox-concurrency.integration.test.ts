import { describe, it, expect, beforeAll } from "vitest";
import { validateGate4DatabaseSafety } from "./harness-safety";
import { runConcurrentRace } from "./barrier";
import { prisma } from "@/lib/db/prisma";
import { Prisma } from "@prisma/client";

describe("Gate 4 — Outbox Processing and Worker Claim Concurrency Suite", () => {
  let safety: ReturnType<typeof validateGate4DatabaseSafety>;

  beforeAll(() => {
    safety = validateGate4DatabaseSafety();
  });

  it("G4-OUT-001 [SKIP LOCKED Worker Claim]: 10 concurrent workers claim pending deliveries using FOR UPDATE SKIP LOCKED without collision", async () => {
    if (!safety.ok) {
      console.warn(`[SKIP_DB_EXECUTION] ${safety.reason}`);
      return;
    }

    const testBatchMarker = `batch_g4_${Date.now()}`;

    // Seed 20 pending notification deliveries
    await prisma.$transaction(async (tx) => {
      for (let i = 0; i < 20; i += 1) {
        await tx.notificationDelivery.create({
          data: {
            publicReference: `nd_g4_${testBatchMarker}_${i}`,
            messageId: `msg_test_${testBatchMarker}_${i}`,
            recipientUserId: `usr_rcp_${i}`,
            channel: "EMAIL",
            status: "PENDING",
            renderedBody: `Outbox body payload test ${i}`,
            eligibilityReason: testBatchMarker,
          },
        });
      }
    });

    // 10 concurrent worker tasks claiming pending deliveries using FOR UPDATE SKIP LOCKED
    const results = await runConcurrentRace(10, async (client, workerIndex, barrier) => {
      await barrier.wait();

      return client.$transaction(async (tx) => {
        const claimedRows = await tx.$queryRaw<Array<{ id: string; publicReference: string }>>(
          Prisma.sql`SELECT "id", "publicReference" FROM "NotificationDelivery" WHERE "eligibilityReason" = ${testBatchMarker} AND "status" = 'PENDING' ORDER BY "createdAt" ASC, "id" ASC LIMIT 2 FOR UPDATE SKIP LOCKED`
        );

        if (claimedRows.length === 0) return { workerIndex, claimedIds: [] };

        const claimedIds = claimedRows.map((r) => r.id);

        await tx.notificationDelivery.updateMany({
          where: { id: { in: claimedIds } },
          data: {
            status: "SENDING",
          },
        });

        return { workerIndex, claimedIds };
      });
    });

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    expect(fulfilled.length).toBe(10);

    const allClaimedIds = fulfilled.flatMap((f) => f.value?.claimedIds ?? []);
    const uniqueClaimedIds = new Set(allClaimedIds);

    // Disjoint claim assertion: no single delivery claimed by more than 1 worker
    expect(allClaimedIds.length).toBe(uniqueClaimedIds.size);

    // Cleanup test outbox rows
    await prisma.notificationDelivery.deleteMany({
      where: { eligibilityReason: testBatchMarker },
    });
  });
});
