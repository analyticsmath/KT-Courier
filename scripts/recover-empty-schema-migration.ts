import { spawnSync } from "node:child_process";
import { prisma } from "../lib/db/prisma";
import { assertHistoricalScopeRecoverySafe, isKnownHistoricalScopeFailure } from "../lib/migrations/marketplace-history-recovery";

async function main() {
  const failed = await prisma.$queryRaw<Array<{ migration_name: string; logs: string | null; applied_steps_count: number }>>`SELECT migration_name, logs, applied_steps_count FROM "_prisma_migrations" WHERE finished_at IS NULL AND rolled_back_at IS NULL`;
  if (!failed.length) return;
  if (failed.length === 1 && isKnownHistoricalScopeFailure(failed[0])) {
    const columns = await prisma.$queryRaw<Array<{ column_name: string; data_type: string }>>`SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'MarketplaceStoreOrder' AND column_name IN ('operationalScope', 'historySourceReference')`;
    if (columns.some(c => c.data_type !== "text")) throw new Error("Unexpected historical scope column type.");
    const changed = columns.length === 2
      ? await prisma.$queryRaw<Array<{ count: number }>>`SELECT count(*)::integer AS count FROM "MarketplaceStoreOrder" WHERE "operationalScope" IS DISTINCT FROM 'LIVE' OR "historySourceReference" IS NOT NULL`
      : [{ count: 0 }];
    const guards = await prisma.$queryRaw<Array<{ count: number }>>`SELECT count(*)::integer AS count FROM pg_trigger WHERE tgrelid = '"MarketplaceStoreOrder"'::regclass AND tgname = 'MarketplaceStoreOrder_history_scope_immutable'`;
    assertHistoricalScopeRecoverySafe(columns.length, changed[0].count, guards[0].count !== 0);
    // The undefined-column failure preceded the first backfill. Retain any
    // additive columns; the corrected migration uses IF NOT EXISTS.
    // Never delete records or mark the migration as successfully applied.
    const result = spawnSync(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "resolve", "--rolled-back", failed[0].migration_name], { stdio: "inherit", env: process.env });
    if (result.error || result.status !== 0) throw new Error("Historical scope migration recovery did not complete.");
    return;
  }
  const target = "20261023104500_normalize_empty_product_attribute_schema";
  if (failed.length !== 1 || failed[0].migration_name !== target || failed[0].applied_steps_count !== 0 || !failed[0].logs?.includes("ACTIVE_PRODUCT_TYPE_IMMUTABLE")) {
    throw new Error("A different migration failure requires independent recovery.");
  }
  // The failed migration consisted of one UPDATE statement. PostgreSQL rejected
  // that statement atomically; no definition changes committed. Retry the
  // corrected INSERT-only successor migration without disabling any trigger.
  const result = spawnSync(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "resolve", "--rolled-back", target], { stdio: "inherit", env: process.env });
  if (result.error || result.status !== 0) throw new Error("Known migration recovery did not complete.");
}
main().catch(() => { console.error("Known migration recovery stopped."); process.exitCode = 1; }).finally(() => prisma.$disconnect());
