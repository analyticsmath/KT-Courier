/* eslint-disable @typescript-eslint/no-explicit-any -- Phase 17 Prisma Client generation and model type proof are intentionally deferred. */
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db/prisma";
import { releaseDriverEarning } from "@/lib/services/driver-earning-release.service";
async function main() { const db = prisma as any; const mature = await db.driverEarning.findMany({ where: { status: "ACCRUED", releaseEligibleAt: { lte: new Date() }, refundReservedAmount: 0 }, select: { id: true }, orderBy: [{ releaseEligibleAt: "asc" }, { id: "asc" }] }); for (const earning of mature) await releaseDriverEarning({ earningId: earning.id, operationId: `mature-driver-release:${randomUUID()}` }); console.log(`Canonical release service evaluated ${mature.length} mature driver earnings.`); }
main().catch((error) => { console.error(error instanceof Error ? error.message : "Mature driver earning release failed."); process.exitCode = 1; }).finally(() => prisma.$disconnect());
