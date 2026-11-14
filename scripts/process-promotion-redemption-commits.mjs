#!/usr/bin/env node
import { register } from "tsx/esm/api";
import { register as registerCommonJs } from "tsx/cjs/api";

let apply = false, modeSet = false, limit = 100, after;
const args = process.argv.slice(2);
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--apply" || args[i] === "--dry-run") {
    if (modeSet) throw new Error("Specify one mode.");
    apply = args[i] === "--apply"; modeSet = true;
  } else if (args[i] === "--limit" && i + 1 < args.length) limit = Number(args[++i]);
  else if (args[i] === "--after" && i + 1 < args.length) after = args[++i];
  else throw new Error("Usage: process-promotion-redemption-commits [--dry-run|--apply] [--limit N] [--after ID]");
}
if (!Number.isInteger(limit) || limit < 1 || limit > 500 || (after !== undefined && (!after || after.length > 200))) throw new Error("Invalid recovery arguments.");
const unregister = register(), unregisterCommonJs = registerCommonJs();
let prisma;
try {
  const [database, recovery, lock] = await Promise.all([import("../lib/db/prisma.ts"), import("../lib/promotions/promotion-commit-recovery.ts"), import("../lib/promotions/production-lock.ts")]);
  prisma = database.prisma;
  if (apply) {
    lock.assertPromotionsProductionReady("COMMITMENT");
    const token = process.env.KT_PROMOTION_ADMIN_SESSION;
    if (!token) throw new Error("An authenticated administrator session is required.");
    const [{ findSessionWithUser, isUserStatusAllowedForSession }, { hasPermission }, { PERMISSIONS }] = await Promise.all([import("../lib/auth/session.ts"), import("../lib/auth/permissions.ts"), import("../lib/auth/permission-keys.ts")]);
    const session = await findSessionWithUser(token);
    if (!session || !isUserStatusAllowedForSession(session.user.status) || !["ADMIN", "SUPER_ADMIN"].includes(session.user.role) || !await hasPermission({ userId: session.user.id, role: session.user.role, permissionKey: PERMISSIONS.PROMOTIONS_RECONCILIATION_MANAGE })) throw new Error("Promotion reconciliation permission is required.");
  }
  const result = await recovery.recoverPromotionCommitments({ limit, after, apply });
  console.log(JSON.stringify({ mode: apply ? "apply" : "dry-run", ...result }));
  if (result.failed) process.exitCode = 1;
} catch {
  console.error("Promotion commitment recovery failed or is not authorized.");
  process.exitCode = 1;
} finally {
  if (prisma) await prisma.$disconnect();
  unregisterCommonJs(); unregister();
}
