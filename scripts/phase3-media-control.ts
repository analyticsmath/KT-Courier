import { prisma } from "../lib/db/prisma";
import { requireDisposableDriverSettlementDatabase } from "./disposable-driver-settlement-guard";

async function main() {
  requireDisposableDriverSettlementDatabase();
  const identity = await prisma.$queryRaw<Array<{ database: string; role: string }>>`SELECT current_database() AS database, current_user AS role`;
  if (identity[0]?.database !== "kt_phase75_e2e" || identity[0]?.role !== "kt_phase75_e2e") throw new Error("Named disposable media database required.");
  const [email] = process.argv.slice(2);
  if (!/^e2e-avatar-(customer|store|driver)-(1440|390)@ktcouriers\.local$/.test(email ?? "")) throw new Error("Independent synthetic profile namespace required.");
  const owner = await prisma.user.findUniqueOrThrow({ where: { email }, select: { id: true, role: true, avatarMediaReference: true } });
  const objects = await prisma.privateMediaObject.findMany({ where: { ownerType: "USER", ownerId: owner.id, purpose: "OTHER" }, select: { publicReference: true, status: true, byteSize: true, detectedMimeType: true }, orderBy: { createdAt: "asc" } });
  console.log(`PROFILE_MEDIA_SNAPSHOT ${JSON.stringify({ avatarReference: owner.avatarMediaReference, role: owner.role, objects })}`);
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
