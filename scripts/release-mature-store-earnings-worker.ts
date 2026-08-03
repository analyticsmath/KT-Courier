import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db/prisma";
import { releaseStoreEarning } from "@/lib/services/store-earning-release.service";

async function main() {
  const mature = await prisma.storeEarning.findMany({ where: { status: "ACCRUED", releaseEligibleAt: { lte: new Date() }, refundReservedAmount: 0 }, select: { id: true }, orderBy: [{ releaseEligibleAt: "asc" }, { id: "asc" }] });
  for (const earning of mature) await releaseStoreEarning({ earningId: earning.id, operationId: `mature-release:${randomUUID()}` });
  console.log(`Canonical release service evaluated ${mature.length} mature store earnings.`);
}

main().catch((error) => { console.error(error instanceof Error ? error.message : "Mature store earning release failed."); process.exitCode = 1; }).finally(() => prisma.$disconnect());
