import { resolveDeveloperApiProductionComposition } from "@/lib/developer-api/composition-root";
import { PHASE28_PROCESSOR_OPERATIONS, type Phase28ProcessorOperation } from "@/lib/developer-api/processor-service";
const [operation, mode, flag, rawLimit] = process.argv.slice(2);
if (!operation || !PHASE28_PROCESSOR_OPERATIONS.includes(operation as Phase28ProcessorOperation) || !["--dry-run", "--apply"].includes(mode) || flag !== "--limit" || !/^\d+$/.test(rawLimit ?? "")) throw new Error("Use a known processor with --dry-run|--apply and --limit 1..1000.");
const limit = Number(rawLimit); if (!Number.isInteger(limit) || limit < 1 || limit > 1000) throw new Error("Invalid Phase 28 processor limit.");
const composition = resolveDeveloperApiProductionComposition();
const candidates = await composition.services.processors.select(operation as Phase28ProcessorOperation, limit);
if (mode === "--apply" && composition.status === "LOCKED") { process.stdout.write(`${JSON.stringify({ operation, apply: true, limit, selectedCandidates: candidates.length, status: composition.status, code: composition.code })}\n`); process.exitCode = 2; }
else { if (mode === "--apply") await Promise.all(candidates.map((candidate) => composition.services.processors.apply(operation as Phase28ProcessorOperation, candidate))); process.stdout.write(`${JSON.stringify({ operation, apply: mode === "--apply", limit, selectedCandidates: candidates.length, candidateReferences: candidates.map((candidate) => candidate.reference), status: composition.status, code: composition.status === "LOCKED" ? composition.code : undefined })}\n`); }
