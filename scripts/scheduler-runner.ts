import os from "node:os";
import { prisma } from "@/lib/db/prisma";
import { executeRegisteredProcessor } from "@/lib/processors/processor-service";
import { logApplicationEvent } from "@/lib/observability/logger";

const SCHEDULER_ID = `scheduler:${os.hostname()}:${process.pid}`;

interface ScheduledTask {
  name: string;
  intervalMs: number;
  lastRunAt: number;
}

const SCHEDULED_TASKS: ScheduledTask[] = [
  // High-frequency jobs (every 1 minute)
  { name: "finalize-paid-marketplace-checkouts", intervalMs: 60_000, lastRunAt: 0 },

  // Medium-frequency jobs (every 2 to 5 minutes)
  { name: "end-expired-promotions", intervalMs: 120_000, lastRunAt: 0 },
  { name: "expire-developer-api-credentials", intervalMs: 120_000, lastRunAt: 0 },
  { name: "process-managed-marketing-lifecycle", intervalMs: 300_000, lastRunAt: 0 },
  { name: "process-subscription-renewals", intervalMs: 300_000, lastRunAt: 0 },
  { name: "process-promoter-qualifications", intervalMs: 300_000, lastRunAt: 0 },

  // Periodic reconciliation & accounting (every 15 to 30 minutes)
  { name: "process-valid-click-charges", intervalMs: 900_000, lastRunAt: 0 },
  { name: "scan-payment-reconciliation", intervalMs: 900_000, lastRunAt: 0 },
  { name: "scan-withdrawal-reconciliation", intervalMs: 900_000, lastRunAt: 0 },
  { name: "scan-refund-reconciliation", intervalMs: 900_000, lastRunAt: 0 },

  // Settlement & cleanup (hourly)
  { name: "release-mature-store-earnings", intervalMs: 3_600_000, lastRunAt: 0 },
  { name: "release-mature-driver-earnings", intervalMs: 3_600_000, lastRunAt: 0 },
  { name: "expire-report-artifacts", intervalMs: 3_600_000, lastRunAt: 0 },

  // Governance & Retention (daily / 24 hours)
  { name: "process-data-retention", intervalMs: 86_400_000, lastRunAt: 0 },
];

let isShuttingDown = false;
let runningTaskCount = 0;

function setupSignalHandlers() {
  const shutdown = async (signal: string) => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    logApplicationEvent({
      level: "INFO",
      event: "scheduler.shutdown_requested",
      message: `Scheduler received ${signal}, finishing in-flight tasks...`,
      actorReference: SCHEDULER_ID,
      outcome: "SUCCESS",
    });

    const deadline = Date.now() + 15_000;
    while (runningTaskCount > 0 && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    try {
      await prisma.$disconnect();
    } catch {
      // ignore
    }

    logApplicationEvent({
      level: "INFO",
      event: "scheduler.stopped",
      message: "Scheduler stopped cleanly.",
      actorReference: SCHEDULER_ID,
      outcome: "SUCCESS",
    });
    process.exit(0);
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

async function runSchedulerLoop() {
  logApplicationEvent({
    level: "INFO",
    event: "scheduler.started",
    message: `Scheduler daemon started with ID: ${SCHEDULER_ID} (${SCHEDULED_TASKS.length} tasks registered)`,
    actorReference: SCHEDULER_ID,
    outcome: "SUCCESS",
  });

  const TICK_INTERVAL_MS = 5_000;

  while (!isShuttingDown) {
    const now = Date.now();

    for (const task of SCHEDULED_TASKS) {
      if (isShuttingDown) break;

      if (now - task.lastRunAt >= task.intervalMs) {
        task.lastRunAt = now;
        runningTaskCount += 1;

        // Fire and track processor execution asynchronously with lease protection
        executeRegisteredProcessor({
          name: task.name,
          mode: "APPLY",
          operationId: `SCHED-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        })
          .then((result) => {
            logApplicationEvent({
              level: "INFO",
              event: "scheduler.task_completed",
              message: `Task '${task.name}' completed (${result.itemsCompleted} items completed, ${result.itemsSkipped} skipped).`,
              actorReference: SCHEDULER_ID,
              resourceReference: task.name,
              outcome: "SUCCESS",
            });
          })
          .catch((err) => {
            const message = err instanceof Error ? err.message : String(err);
            // "Active unexpired lease" is normal in a multi-replica scheduler cluster and is logged at debug/info
            if (message.includes("Active unexpired lease") || message.includes("Concurrent lease acquisition")) {
              logApplicationEvent({
                level: "DEBUG",
                event: "scheduler.task_lease_skipped",
                message: `Task '${task.name}' skipped: active lease held by peer replica.`,
                actorReference: SCHEDULER_ID,
                resourceReference: task.name,
                outcome: "SUCCESS",
              });
            } else {
              logApplicationEvent({
                level: "WARN",
                event: "scheduler.task_error",
                message: `Task '${task.name}' failed: ${message}`,
                actorReference: SCHEDULER_ID,
                resourceReference: task.name,
                outcome: "FAILURE",
              });
            }
          })
          .finally(() => {
            runningTaskCount = Math.max(0, runningTaskCount - 1);
          });
      }
    }

    if (isShuttingDown) break;
    await new Promise((resolve) => setTimeout(resolve, TICK_INTERVAL_MS));
  }
}

setupSignalHandlers();
runSchedulerLoop().catch((err) => {
  console.error("Fatal scheduler error:", err);
  process.exit(1);
});
