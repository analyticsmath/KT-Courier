import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const runner = path.join(root, "scripts", "phase27-processor-runner.ts");
const tsxCli = path.join(root, "node_modules", "tsx", "dist", "cli.mjs");
export const PHASE27_PROCESSORS = Object.freeze({
  preflight: "NotificationProcessorService", consume: "NotificationSourceIntakeService", fanout: "NotificationSourceIntakeService", deliver: "NotificationDeliveryService", retry: "NotificationDeliveryService", receipts: "provider receipt authority", digest: "NotificationDigestService", expire: "NotificationProcessorService", "stale-endpoints": "NotificationProcessorService", reconciliation: "NotificationReconciliationService", invariants: "NotificationProcessorService", integration: "NotificationProcessorService",
});
export function runPhase27Processor(operation, argv = process.argv.slice(2)) {
  if (!PHASE27_PROCESSORS[operation]) throw new Error(`Unknown Phase 27 processor: ${operation}`);
  let apply = false; let limit = 100;
  for (let i = 0; i < argv.length; i += 1) { if (argv[i] === "--apply") apply = true; else if (argv[i] === "--dry-run") apply = false; else if (argv[i] === "--limit" && /^\d+$/.test(argv[i + 1] ?? "")) { limit = Number(argv[++i]); } else throw new Error("Use --dry-run|--apply and --limit 1..1000."); }
  if (limit < 1 || limit > 1000) throw new Error("--limit must be an integer between 1 and 1000.");
  const result = spawnSync(process.execPath, [tsxCli, runner, operation, apply ? "--apply" : "--dry-run", "--limit", String(limit)], { cwd: root, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exitCode = result.status ?? 1;
}
