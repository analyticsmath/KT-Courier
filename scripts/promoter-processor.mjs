import { createHash } from "node:crypto";
import { register } from "tsx/esm/api";

export function parseArguments(argv) {
  const args = new Set(argv); const limitEntry = [...args].find((arg) => arg.startsWith("--limit="));
  if ((args.has("--dry-run") ? 1 : 0) + (args.has("--apply") ? 1 : 0) > 1 || [...args].some((arg) => !["--dry-run", "--apply"].includes(arg) && !arg.startsWith("--limit="))) throw new Error("Use --dry-run or --apply with optional --limit=N.");
  const limit = limitEntry ? Number(limitEntry.slice(8)) : 100;
  if (!Number.isInteger(limit) || limit < 1 || limit > 500) throw new Error("--limit must be an integer from 1 to 500.");
  return { apply: args.has("--apply"), limit };
}

const operationId = (processor, reference) => `${processor}:${createHash("sha256").update(reference).digest("hex").slice(0, 32)}`;

/** Bounded selection is read-only. All state transitions remain in canonical TS services. */
export async function runPromoterProcessor({ name, selectCandidates, process }) {
  const options = parseArguments(process.argv.slice(2));
  const unregister = register({ onImport: () => {} });
  try {
    const [{ prisma }, { resolvePromoterProductionComposition }] = await Promise.all([import("../lib/db/prisma.ts"), import("../lib/promoters/composition-root.ts")]);
    const root = resolvePromoterProductionComposition();
    const candidates = await selectCandidates(prisma, options.limit);
    if (!options.apply) { console.log(`${name}: selected ${candidates.length} bounded candidate(s); no state was changed.`); return; }
    if (root.status === "LOCKED") { console.log(`${name}: selected ${candidates.length} candidate(s); production lock ${root.code} prevented mutation.`); return; }
    for (const candidate of candidates) await process({ prisma, root, candidate, operationId: operationId(name, candidate.publicReference ?? candidate.id) });
    console.log(`${name}: processed ${candidates.length} candidate(s) through canonical services.`);
  } finally { unregister(); }
}
