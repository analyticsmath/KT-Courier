import { resolveNotificationProductionComposition } from "@/lib/notifications/composition-root";

const [operation, mode, flag, rawLimit] = process.argv.slice(2);
if (!operation || !["--dry-run", "--apply"].includes(mode) || flag !== "--limit" || !/^\d+$/.test(rawLimit ?? "")) throw new Error("Use --dry-run|--apply and --limit 1..1000.");
const limit = Number(rawLimit);
if (!Number.isInteger(limit) || limit < 1 || limit > 1_000) throw new Error("Invalid Phase 27 processor limit.");

const composition = resolveNotificationProductionComposition();
try {
  const result = await composition.services.processors.run({ operation: operation as any, apply: mode === "--apply", limit });
  console.log(JSON.stringify({ ...result, production: { status: composition.status, code: composition.status === "LOCKED" ? composition.code : undefined } }));
} catch (error) {
  const code = error && typeof error === "object" && "code" in error ? String((error as { code: string }).code) : "NOTIFICATION_PROCESSOR_FAILED";
  console.log(JSON.stringify({ operation, apply: mode === "--apply", status: "LOCKED", code }));
  if (mode === "--apply") process.exitCode = 2;
}
