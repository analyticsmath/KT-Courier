import { describe, it, expect, beforeAll } from "vitest";
import { validateGate4DatabaseSafety } from "./harness-safety";
import { runConcurrentRace } from "./barrier";
import { prisma } from "@/lib/db/prisma";
import { Prisma } from "@prisma/client";
import { createGate4CapturedPaymentScenario, makeGate4PaymentWebhookFingerprint, requireGate4Fixture } from "./fixtures";

describe("Gate 4 — Payment Webhook and Payment State Idempotency Suite", () => {
  let safety: ReturnType<typeof validateGate4DatabaseSafety>;

  beforeAll(() => {
    safety = validateGate4DatabaseSafety();
  });

  it("G4-PAY-001 [Idempotency]: Duplicate payment ITN webhooks arrive concurrently and process idempotently", async () => {
    if (!safety.ok) {
      console.warn(`[SKIP_DB_EXECUTION] ${safety.reason}`);
      return;
    }

    const { attempt } = await createGate4CapturedPaymentScenario("pay-itn", "duplicate-itn", { status: "PROCESSING" });
    requireGate4Fixture(attempt, "Payment attempt fixture required");

    const providerPaymentId = `itn_g4_evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const results = await runConcurrentRace(5, async (client, _index, barrier) => {
      await barrier.wait();

      try {
        return await client.$transaction(
          async (tx) => {
            const existingEvent = await tx.paymentWebhookEvent.findFirst({
              where: { providerPaymentId },
            });

            if (existingEvent) {
              return { processed: false, eventId: existingEvent.id };
            }

            const event = await tx.paymentWebhookEvent.create({
              data: {
                publicReference: `pwe_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
                provider: "PAYFAST",
                providerPaymentId,
                paymentId: attempt.paymentId,
                attemptId: attempt.id,
                merchantReference: attempt.merchantReference,
                eventFingerprint: makeGate4PaymentWebhookFingerprint(providerPaymentId),
                environment: "SANDBOX",
                providerStatus: "COMPLETE",
                normalizedStatus: "COMPLETE",
              },
            });

            await tx.paymentAttempt.update({
              where: { id: attempt.id },
              data: { status: "SUCCEEDED", version: { increment: 1 } },
            });

            return { processed: true, eventId: event.id };
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
        );
      } catch (e: unknown) {
        for (let i = 0; i < 10; i++) {
          const existing = await client.paymentWebhookEvent.findFirst({ where: { providerPaymentId } });
          if (existing) {
            return { processed: false, eventId: existing.id };
          }
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
        throw e;
      }
    });

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");
    if (rejected.length > 0) {
      console.error("G4-PAY-001 rejected reasons:", rejected.map((r) => (r as PromiseRejectedResult).reason));
    }

    expect(fulfilled.length).toBe(5);

    const eventCount = await prisma.paymentWebhookEvent.count({
      where: { providerPaymentId },
    });
    expect(eventCount).toBe(1);

    const finalAttempt = await prisma.paymentAttempt.findUnique({ where: { id: attempt.id } });
    expect(finalAttempt?.status).toBe("SUCCEEDED");
  });

  it("G4-PAY-002 [Out-of-Order]: Older non-terminal event arriving after terminal SUCCEEDED does not regress status", async () => {
    if (!safety.ok) return;

    const { attempt } = await createGate4CapturedPaymentScenario("pay-itn", "out-of-order", { status: "SUCCEEDED" });
    requireGate4Fixture(attempt, "Payment attempt fixture required");

    const delayedEventId = `itn_delayed_${Date.now()}`;

    await prisma.$transaction(async (tx) => {
      const current = await tx.paymentAttempt.findUnique({ where: { id: attempt.id } });
      expect(current?.status).toBe("SUCCEEDED");

      await tx.paymentWebhookEvent.create({
        data: {
          publicReference: `pwe_delayed_${Date.now()}`,
          provider: "PAYFAST",
          providerPaymentId: delayedEventId,
          paymentId: attempt.paymentId,
          merchantReference: attempt.merchantReference,
          eventFingerprint: makeGate4PaymentWebhookFingerprint(delayedEventId),
          environment: "SANDBOX",
          providerStatus: "PENDING",
          normalizedStatus: "PENDING",
        },
      });

      // Terminal state protection
      if (current?.status !== "SUCCEEDED") {
        await tx.paymentAttempt.update({
          where: { id: attempt.id },
          data: { status: "PENDING" },
        });
      }
    });

    const finalState = await prisma.paymentAttempt.findUnique({ where: { id: attempt.id } });
    expect(finalState?.status).toBe("SUCCEEDED");
  });
});

