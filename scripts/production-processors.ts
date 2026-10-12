import { createServer } from "node:http";
import { prisma } from "../lib/db/prisma";
import { executeRegisteredProcessor } from "../lib/processors/processor-service";
import { productionProcessors, runProductionCycle } from "../lib/processors/production-loop";
import type { ProductionProcessor } from "../lib/processors/production-loop";
import { createPrismaVerifiedPaymentEventRepository } from "../lib/payments/verified-payment-event-processor.service";
import { listPendingCustomerOrderIntents } from "../lib/notifications/customer-order-publication";
import { emailWorkWhere } from "../lib/notifications/email-delivery-recovery";

let stopping = false;
let lastCycleAt = 0;
let healthy = false;
let wake: (() => void) | undefined;
const server = createServer((request, response) => {
  if (request.url !== "/health") { response.writeHead(404).end(); return; }
  const ready = !stopping && healthy && Date.now() - lastCycleAt < 420_000;
  response.writeHead(ready ? 200 : 503, { "content-type": "application/json" });
  response.end(JSON.stringify({ ready, processors: productionProcessors, lastCycleAt: lastCycleAt ? new Date(lastCycleAt).toISOString() : null }));
});
server.listen(Number(process.env.PORT ?? 3000), "0.0.0.0");
const shutdown = () => { stopping = true; healthy = false; wake?.(); };
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

async function main() {
  let firstCycle = true;
  async function hasWork(name: ProductionProcessor) {
    if (name === "consume-verified-payment-events") return (await createPrismaVerifiedPaymentEventRepository(prisma).listCandidates(1)).length > 0;
    if (name === "apply-paystack-webhook-events") return !!await prisma.paymentWebhookEvent.findFirst({ where: { provider: "PAYSTACK", OR: [{ processingStatus: "RECEIVED" }, { processingStatus: "PROCESSING", leaseExpiresAt: { lt: new Date() } }] }, select: { id: true } });
    return (await listPendingCustomerOrderIntents(1)).length > 0 || !!await prisma.notificationDelivery.findFirst({ where: emailWorkWhere(), select: { id: true } });
  }
  while (!stopping) {
    const results = await runProductionCycle(executeRegisteredProcessor, () => stopping, firstCycle ? undefined : hasWork);
    firstCycle = false;
    lastCycleAt = Date.now();
    healthy = results.length === productionProcessors.length && results.every((result) => result.status !== "FAILED" && result.itemsRetried === 0);
    try {
      const value = { observedAt: new Date(lastCycleAt).toISOString(), healthy, releaseSha: process.env.RAILWAY_GIT_COMMIT_SHA ?? null, processors: results.map((result) => ({ name: result.name, status: result.status, itemsRetried: result.itemsRetried })) };
      await prisma.systemSetting.upsert({ where: { key: "production_processor_heartbeat" }, create: { key: "production_processor_heartbeat", label: "Operations processor heartbeat", type: "JSON", value }, update: { value } });
    } catch { healthy = false; console.error(JSON.stringify({ event: "production_processors.heartbeat_failed", category: "DATABASE_UNAVAILABLE" })); }
    console.log(JSON.stringify({ event: "production_processors.cycle", healthy, results }));
    if (!stopping) await new Promise<void>((resolve) => {
      const timer = setTimeout(() => { wake = undefined; resolve(); }, 30_000);
      wake = () => { clearTimeout(timer); wake = undefined; resolve(); };
    });
  }
}
main().catch(() => { console.error("Production processor loop failed."); process.exitCode = 1; })
  .finally(async () => { healthy = false; server.close(); await prisma.$disconnect(); });
