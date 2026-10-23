import { spawnSync } from "node:child_process";
import { prisma } from "../lib/db/prisma";

async function main() {
  const failed = await prisma.$queryRaw<Array<{ migration_name: string; logs: string | null; applied_steps_count: number }>>`SELECT migration_name, logs, applied_steps_count FROM "_prisma_migrations" WHERE finished_at IS NULL AND rolled_back_at IS NULL`;
  if (!failed.length) return;
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
main().catch(() => { console.error("Catalog schema migration recovery stopped."); process.exitCode = 1; }).finally(() => prisma.$disconnect());
