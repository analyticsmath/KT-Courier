#!/usr/bin/env node
import { register } from "tsx/esm/api";
import { register as registerCommonJs } from "tsx/cjs/api";

if (process.argv.slice(2).some(arg => arg !== "--dry-run")) throw new Error("Usage: phase23-promotion-preflight [--dry-run]");
const unregister = register(), unregisterCommonJs = registerCommonJs();
let prisma;
try {
  const [database, lock, permissions] = await Promise.all([import("../lib/db/prisma.ts"), import("../lib/promotions/production-lock.ts"), import("../lib/auth/permission-keys.ts")]);
  prisma = database.prisma;
  const required = ["PromotionCampaign", "PromotionCampaignVersion", "PromotionBudget", "PromotionBudgetMovement", "PromotionCode", "PromotionReservation", "PromotionRedemption", "PromotionFinancialAllocation", "PromotionOperation", "PromotionReconciliationCase", "LedgerJournal", "LedgerEntry", "_prisma_migrations"];
  const tables = await prisma.$queryRaw`SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = current_schema()`;
  const present = new Set(tables.map(row => row.tablename));
  const missingTables = required.filter(name => !present.has(name));
  const failedMigrations = present.has("_prisma_migrations") ? Number((await prisma.$queryRaw`SELECT count(*)::integer AS count FROM "_prisma_migrations" WHERE finished_at IS NULL AND rolled_back_at IS NULL`)[0].count) : null;
  const permissionKeys = ["PROMOTIONS_READ", "PROMOTIONS_MANAGE", "PROMOTIONS_APPROVE", "PROMOTIONS_ACTIVATE", "PROMOTIONS_RECONCILIATION_READ", "PROMOTIONS_RECONCILIATION_MANAGE"];
  const missingPermissions = permissionKeys.filter(key => typeof permissions.PERMISSIONS[key] !== "string");
  const gate = lock.evaluatePromotionsReleaseGate();
  console.log(JSON.stringify({ databaseReachable: true, missingTables, failedMigrations, missingPermissions, releaseGate: gate }));
  if (missingTables.length || failedMigrations || missingPermissions.length) process.exitCode = 1;
} catch {
  console.error("Promotion preflight could not verify database and application configuration.");
  process.exitCode = 1;
} finally {
  if (prisma) await prisma.$disconnect();
  unregisterCommonJs(); unregister();
}
