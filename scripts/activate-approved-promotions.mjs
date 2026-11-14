#!/usr/bin/env node
import { register } from "tsx/esm/api";
import { register as registerCommonJs } from "tsx/cjs/api";

const args = process.argv.slice(2);
let apply = false, modeSeen = false, limit = 50, reference;
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--apply" || args[i] === "--dry-run") {
    if (modeSeen) throw new Error("Specify one mode.");
    apply = args[i] === "--apply"; modeSeen = true;
  } else if (args[i] === "--limit" && i + 1 < args.length) limit = Number(args[++i]);
  else if (args[i] === "--reference" && i + 1 < args.length) reference = args[++i];
  else throw new Error("Usage: activate-approved-promotions [--dry-run|--apply] [--limit N] [--reference REF]");
}
if (!Number.isInteger(limit) || limit < 1 || limit > 200 || (reference !== undefined && (!reference.trim() || reference.length > 200))) throw new Error("Invalid activation batch arguments.");
const unregister = register(); const unregisterCommonJs = registerCommonJs();
let prisma;
try {
  const [database, { assertPromotionsProductionReady }, { activateAdminCampaign }] = await Promise.all([
    import("../lib/db/prisma.ts"), import("../lib/promotions/production-lock.ts"), import("../lib/promotions/admin-promotions.service.ts"),
  ]);
  prisma = database.prisma;
  let actorUserId;
  if (apply) {
    assertPromotionsProductionReady("CAMPAIGN_ACTIVATE");
    const token = process.env.KT_PROMOTION_ADMIN_SESSION;
    if (!token) throw new Error("An authenticated administrator session is required.");
    const [{ findSessionWithUser, isUserStatusAllowedForSession }, { hasPermission }, { PERMISSIONS }] = await Promise.all([
      import("../lib/auth/session.ts"), import("../lib/auth/permissions.ts"), import("../lib/auth/permission-keys.ts"),
    ]);
    const session = await findSessionWithUser(token);
    if (!session || !isUserStatusAllowedForSession(session.user.status) || !["ADMIN", "SUPER_ADMIN"].includes(session.user.role) || !await hasPermission({ userId: session.user.id, role: session.user.role, permissionKey: PERMISSIONS.PROMOTIONS_ACTIVATE })) throw new Error("Promotion activation permission is required.");
    actorUserId = session.user.id;
  }
  const now = new Date();
  const candidates = await prisma.promotionCampaign.findMany({
    where: { status: "APPROVED", ...(reference ? { publicReference: reference } : {}), versions: { some: { status: "APPROVED", startsAt: { lte: now }, endsAt: { gt: now }, budget: { is: { status: "ACTIVE" } } } } },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }], take: limit, select: { publicReference: true },
  });
  let activated = 0, skipped = 0, failed = 0;
  if (apply) for (const candidate of candidates) {
    try { await activateAdminCampaign(candidate.publicReference, actorUserId); activated++; }
    catch {
      const current = await prisma.promotionCampaign.findUnique({ where: { publicReference: candidate.publicReference }, select: { status: true } });
      if (current?.status === "ACTIVE") skipped++; else failed++;
    }
  }
  console.log(JSON.stringify({ mode: apply ? "apply" : "dry-run", examined: candidates.length, activated, skipped, failed }));
  if (failed) process.exitCode = 1;
} catch {
  console.error("Promotion activation failed or is not authorized.");
  process.exitCode = 1;
} finally {
  if (prisma) await prisma.$disconnect();
  unregisterCommonJs(); unregister();
}
