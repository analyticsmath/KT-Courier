import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const required = [
  "prisma/migrations/20260717130000_phase21_store_order_management/migration.sql",
  "docs/phase-21-research-and-implementation-map.md",
  "lib/store-orders/production-lock.ts",
  "lib/store-orders/store-order.service.ts",
];
for (const relative of required) if (!existsSync(resolve(root, relative))) throw new Error(`Missing Phase 21 required file: ${relative}`);
const migration = readFileSync(resolve(root, required[0]), "utf8");
for (const token of ["StoreOrderOperationalPolicy", "MarketplaceStoreOrderAdjustment", "MarketplaceStoreOrderPickupHandoff", "ORDER_SUBSTITUTION_RESERVATION"]) if (!migration.includes(token)) throw new Error(`Phase 21 migration is missing ${token}.`);
console.log("Phase 21 store-order preflight passed. Database deployment is intentionally not attempted.");
