import { prisma } from "../lib/db/prisma";
import { requireDisposableDriverSettlementDatabase } from "./disposable-driver-settlement-guard";

async function main() {
  requireDisposableDriverSettlementDatabase();
  const identity = await prisma.$queryRaw<Array<{ database: string; role: string }>>`SELECT current_database() AS database, current_user AS role`;
  if (identity[0]?.database !== "kt_phase75_e2e" || identity[0]?.role !== "kt_phase75_e2e") throw new Error("Named disposable media database required.");
  const [email, action] = process.argv.slice(2);
  if (!/^e2e-avatar-(customer|store|driver)-(1440|390)@ktcouriers\.local$/.test(email ?? "")) throw new Error("Independent synthetic profile namespace required.");
  const owner = await prisma.user.findUniqueOrThrow({ where: { email }, select: { id: true, role: true, avatarMediaReference: true } });
  if (action === "branding") {
    if (owner.role !== "STORE") throw new Error("Synthetic store ownership required.");
    const store = await prisma.store.findFirstOrThrow({ where: { ownerUserId: owner.id } });
    const assets = await prisma.catalogMediaAsset.findMany({ where: { ownerType: "STORE", ownerStoreId: store.id, purpose: { in: ["STORE_LOGO", "STORE_HERO"] } }, select: { publicReference: true, purpose: true, status: true, mimeType: true, width: true, height: true, privacyInspectionPassed: true }, orderBy: { createdAt: "asc" } });
    const projection = await prisma.storefrontStoreDocument.findUnique({ where: { storeId: store.id }, select: { logoMediaReference: true, heroMediaReference: true } });
    const history = await prisma.catalogMediaHistory.findMany({ where: { asset: { ownerStoreId: store.id, purpose: { in: ["STORE_LOGO", "STORE_HERO"] } } }, select: { action: true, fromStatus: true, toStatus: true }, orderBy: { createdAt: "asc" } });
    console.log(`STORE_BRANDING_SNAPSHOT ${JSON.stringify({ assets, projection, history })}`); return;
  }
  const objects = await prisma.privateMediaObject.findMany({ where: { ownerType: "USER", ownerId: owner.id, purpose: "OTHER" }, select: { publicReference: true, status: true, byteSize: true, detectedMimeType: true }, orderBy: { createdAt: "asc" } });
  console.log(`PROFILE_MEDIA_SNAPSHOT ${JSON.stringify({ avatarReference: owner.avatarMediaReference, role: owner.role, objects })}`);
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
