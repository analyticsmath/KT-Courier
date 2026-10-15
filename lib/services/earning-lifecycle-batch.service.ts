import { prisma } from "@/lib/db/prisma";
import type { ProcessorHandlerContext, ProcessorHandlerOutcome } from "@/lib/processors/processor-service";
import { produceDriverSettlement } from "./driver-settlement-producer.service";
import { assignEarningClearance } from "./earning-clearance-batch.service";
import { releaseDriverEarning } from "./driver-earning-release.service";
import { releaseStoreEarning } from "./store-earning-release.service";
import { DriverEarningError } from "@/lib/driver-earnings/errors";
import { StoreEarningError } from "@/lib/store-earnings/errors";
import { CommissionError } from "@/lib/commissions/errors";

const CURSOR_KEY = "finance.earning_lifecycle_cursor.v1";
type Phase = "deliveries" | "stores" | "drivers";
type Cursors = Record<Phase, string | null>;
function readCursors(value: unknown): Cursors {
  const record = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const cursor = (key: Phase) => typeof record[key] === "string" ? record[key] as string : null;
  return { deliveries: cursor("deliveries"), stores: cursor("stores"), drivers: cursor("drivers") };
}

/** Runs under the registered processor lease. Canonical commands retain every
 * funding, completed-assignment, policy, incident and ledger eligibility check.
 * Independent stable cursors revisit blocked work without starving later rows.
 * A crash before cursor persistence safely replays the idempotent commands. */
export async function runEarningLifecycleBatch({ mode, batchSize }: Pick<ProcessorHandlerContext, "mode" | "batchSize">): Promise<ProcessorHandlerOutcome> {
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 25) throw new Error("Earning lifecycle batch size must be between 1 and 25 per phase.");
  const now = new Date();
  const state = await prisma.systemSetting.findUnique({ where: { key: CURSOR_KEY } });
  const cursors = readCursors(state?.value);
  const result: ProcessorHandlerOutcome = { itemsExamined: 0, itemsClaimed: 0, itemsCompleted: 0, itemsSkipped: 0, itemsRetried: 0, itemsReconciled: 0, safeSummary: "" };
  const blockers = new Set<string>();
  function defer(error: unknown) {
    // Policy, funding and incident refusals are expected held work. They must
    // not make the shared payment/notification worker fail its health probe.
    // Infrastructure or unexpected errors still report a failed cycle.
    if (error instanceof DriverEarningError || error instanceof StoreEarningError || error instanceof CommissionError) {
      result.itemsSkipped++; blockers.add(error.code);
    } else result.itemsRetried++;
  }
  const deliveries = await prisma.order.findMany({ where: { id: cursors.deliveries ? { gt: cursors.deliveries } : undefined, status: { in: ["DELIVERED", "COMPLETED"] }, assignments: { some: { status: "COMPLETED" } }, driverEarnings: { none: {} } }, orderBy: { id: "asc" }, select: { id: true }, take: batchSize });
  for (const row of deliveries) {
    result.itemsExamined++;
    if (mode === "DRY_RUN") { result.itemsSkipped++; continue; }
    result.itemsClaimed++;
    try { await produceDriverSettlement(row.id); result.itemsCompleted++; }
    catch (error) { defer(error); }
  }
  cursors.deliveries = deliveries.length === batchSize ? deliveries.at(-1)!.id : null;
  for (const [phase, kind] of [["stores", "STORE"], ["drivers", "DRIVER"]] as const) {
    const args = { where: { status: "ACCRUED" as const, id: cursors[phase] ? { gt: cursors[phase]! } : undefined, OR: [{ releaseEligibleAt: null }, { releaseEligibleAt: { lte: now } }] }, orderBy: { id: "asc" as const }, select: { id: true }, take: batchSize };
    const rows = kind === "STORE" ? await prisma.storeEarning.findMany(args) : await prisma.driverEarning.findMany(args);
    for (const row of rows) {
      result.itemsExamined++;
      if (mode === "DRY_RUN") { result.itemsSkipped++; continue; }
      result.itemsClaimed++;
      try {
        const assigned = await assignEarningClearance(kind, row.id, now);
        const args = { where: { id: row.id }, select: { status: true, releaseEligibleAt: true } };
        const current = kind === "STORE" ? await prisma.storeEarning.findUnique(args) : await prisma.driverEarning.findUnique(args);
        if (current?.status === "ACCRUED" && current.releaseEligibleAt && current.releaseEligibleAt <= now) {
          const command = { earningId: row.id, operationId: `automatic-earning-release:${row.id}`, now };
          if (kind === "STORE") await releaseStoreEarning(command); else await releaseDriverEarning(command);
          result.itemsCompleted++;
        } else if (assigned) result.itemsCompleted++;
        else result.itemsSkipped++;
      } catch (error) { defer(error); }
    }
    cursors[phase] = rows.length === batchSize ? rows.at(-1)!.id : null;
  }
  if (mode === "APPLY") await prisma.systemSetting.upsert({ where: { key: CURSOR_KEY }, create: { key: CURSOR_KEY, type: "JSON", label: "Earning lifecycle processor cursors", value: cursors }, update: { value: cursors } });
  result.safeSummary = `${mode}: earning lifecycle examined ${result.itemsExamined}; advanced ${result.itemsCompleted}; held ${result.itemsSkipped}; retry ${result.itemsRetried}. Policy/funding review: ${[...blockers].sort().join(", ") || "none"}. No external payout is executed.`;
  return result;
}
