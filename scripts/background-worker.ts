import os from "node:os";
import { prisma } from "@/lib/db/prisma";
import { consumeVerifiedPaymentEvents } from "@/lib/payments/verified-payment-event-processor.service";
import { logApplicationEvent } from "@/lib/observability/logger";

const WORKER_ID = `worker:${os.hostname()}:${process.pid}`;
const POLL_INTERVAL_IDLE_MS = 5_000;
const POLL_INTERVAL_BUSY_MS = 250;
const BATCH_SIZE = 50;

let isShuttingDown = false;
let isBusy = false;

function setupSignalHandlers() {
  const shutdown = async (signal: string) => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    logApplicationEvent({
      level: "INFO",
      event: "worker.shutdown_requested",
      message: `Worker received ${signal}, gracefully finishing in-flight tasks...`,
      actorReference: WORKER_ID,
      outcome: "SUCCESS",
    });

    // Allow in-flight operations up to 10 seconds to finish
    const deadline = Date.now() + 10_000;
    while (isBusy && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    try {
      await prisma.$disconnect();
    } catch {
      // ignore during shutdown
    }

    logApplicationEvent({
      level: "INFO",
      event: "worker.stopped",
      message: "Worker stopped cleanly.",
      actorReference: WORKER_ID,
      outcome: "SUCCESS",
    });
    process.exit(0);
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

async function runWorkerLoop() {
  logApplicationEvent({
    level: "INFO",
    event: "worker.started",
    message: `Background event worker started with ID: ${WORKER_ID}`,
    actorReference: WORKER_ID,
    outcome: "SUCCESS",
  });

  while (!isShuttingDown) {
    let hasMoreWork = false;
    isBusy = true;

    try {
      // 1. Consume verified payment events (outbox)
      const paymentOutcomes = await consumeVerifiedPaymentEvents({ limit: BATCH_SIZE });
      const processedPayments =
        paymentOutcomes.MARKETPLACE_FINALIZED +
        paymentOutcomes.SUBSCRIPTION_ACTIVATED +
        paymentOutcomes.MANAGED_MARKETING_RECOGNIZED +
        paymentOutcomes.NO_DOWNSTREAM_EFFECT;

      if (processedPayments > 0) {
        hasMoreWork = true;
        logApplicationEvent({
          level: "INFO",
          event: "worker.payments_consumed",
          message: `Consumed ${processedPayments} verified payment events.`,
          actorReference: WORKER_ID,
          context: paymentOutcomes as Record<string, unknown>,
          outcome: "SUCCESS",
        });
      }
    } catch (err) {
      logApplicationEvent({
        level: "ERROR",
        event: "worker.cycle_error",
        message: err instanceof Error ? err.message : "Error during worker processing cycle",
        actorReference: WORKER_ID,
        outcome: "FAILURE",
      });
    } finally {
      isBusy = false;
    }

    if (isShuttingDown) break;

    const delay = hasMoreWork ? POLL_INTERVAL_BUSY_MS : POLL_INTERVAL_IDLE_MS;
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
}

setupSignalHandlers();
runWorkerLoop().catch((err) => {
  console.error("Fatal worker error:", err);
  process.exit(1);
});
