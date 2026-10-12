import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { createHash } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { LocalPrivateMediaStorageAdapter } from "@/lib/private-media/private-media-storage";
import { PrivateMediaPolicyError, PrivateMediaService } from "@/lib/private-media/private-media.service";
import { PrivateMediaOwnerType, PrivateMediaPurpose, UserRole, UserStatus, VehicleType } from "@/types/db";

const marker = randomUUID();
let root = "";
let safetyValidated = false;
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAEUlEQVQImWPgEpHjEpFjgFAABk4A8YCCZIUAAAAASUVORK5CYII=", "base64");
let driverOneUserId = "";
let driverTwoUserId = "";
let vehicleOneId = "";
let vehicleTwoId = "";
let driverOneProfileId = "";
let driverTwoProfileId = "";

async function createDriver(suffix: string) {
  const user = await prisma.user.create({ data: { email: `phase-b-${marker}-${suffix}@example.test`, passwordHash: "phase-b-test-only", role: UserRole.DRIVER, status: UserStatus.ACTIVE, name: `Phase B ${suffix}` } });
  const profile = await prisma.driverProfile.create({ data: { userId: user.id, driverCode: `PB-${marker.slice(0, 8)}-${suffix}`, displayName: `Phase B ${suffix}`, active: true, status: "ACTIVE", vehicleComplianceRequiredAt: new Date() } });
  return { user, profile };
}

beforeAll(async () => {
  const url = new URL(process.env.DATABASE_URL ?? "postgres://localhost/absent");
  const approvedDatabase = url.pathname === "/kt_launch_test" || (url.pathname === "/kt_courier_phase_b_runtime_disposable" && process.env.KT_PHASEB_RUNTIME_APPROVED === "1");
  if (process.env.NODE_ENV === "production" || process.env.KT_ALLOW_ISOLATED_POSTGRES_TESTS !== "1" || !approvedDatabase || !["localhost", "127.0.0.1"].includes(url.hostname)) throw new Error("Disposable private-media database required.");
  safetyValidated = true;
  root = await mkdtemp(path.join(os.tmpdir(), "kt-phase-b-private-media-"));
  await prisma.$queryRawUnsafe("SELECT 1");
  const one = await createDriver("one");
  const two = await createDriver("two");
  driverOneUserId = one.user.id;
  driverTwoUserId = two.user.id;
  driverOneProfileId = one.profile.id;
  driverTwoProfileId = two.profile.id;
  vehicleOneId = (await prisma.vehicle.create({ data: { publicReference: `VEH-${marker}-one`, driverProfileId: one.profile.id, make: "Test", model: "One", registrationNumber: `PB${marker.slice(0, 12).toUpperCase()}`, vehicleType: VehicleType.CAR } })).id;
  vehicleTwoId = (await prisma.vehicle.create({ data: { publicReference: `VEH-${marker}-two`, driverProfileId: two.profile.id, make: "Test", model: "Two", registrationNumber: `PC${marker.slice(0, 12).toUpperCase()}`, vehicleType: VehicleType.CAR } })).id;
});

afterAll(async () => {
  if (!safetyValidated) return;
  await prisma.vehicleDocument.deleteMany({ where: { vehicle: { driverProfile: { driverCode: { startsWith: `PB-${marker.slice(0, 8)}` } } } } });
  await prisma.vehicleMedia.deleteMany({ where: { vehicle: { driverProfile: { driverCode: { startsWith: `PB-${marker.slice(0, 8)}` } } } } });
  await prisma.privateMediaObject.deleteMany({ where: { publicReference: { startsWith: "PMO-" }, createdByUserId: { in: [driverOneUserId, driverTwoUserId] } } });
  await prisma.vehicle.deleteMany({ where: { id: { in: [vehicleOneId, vehicleTwoId] } } });
  await prisma.driverProfile.deleteMany({ where: { id: { in: [driverOneProfileId, driverTwoProfileId] } } });
  await prisma.user.deleteMany({ where: { id: { in: [driverOneUserId, driverTwoUserId] } } });
  const resolvedRoot = path.resolve(root);
  if (path.dirname(resolvedRoot) !== path.resolve(os.tmpdir()) || !path.basename(resolvedRoot).startsWith("kt-phase-b-private-media-")) throw new Error("Refusing unexpected private-media cleanup path.");
  await rm(resolvedRoot, { recursive: true, force: true });
});

describe("Phase B private media and vehicle PostgreSQL invariants", () => {
  it("enforces active vehicle registration uniqueness", async () => {
    await expect(prisma.vehicle.create({ data: { publicReference: `VEH-${marker}-duplicate`, driverProfileId: driverOneProfileId, make: "Test", model: "Duplicate", registrationNumber: `PC${marker.slice(0, 12).toUpperCase()}`, vehicleType: VehicleType.VAN } })).rejects.toMatchObject({ code: "P2002" });
  });

  it("rejects document/media associations that cross vehicle ownership", async () => {
    const media = await prisma.privateMediaObject.create({ data: { publicReference: `PMO-${randomUUID()}`, ownerType: PrivateMediaOwnerType.VEHICLE, ownerId: vehicleOneId, purpose: PrivateMediaPurpose.VEHICLE_REGISTRATION, status: "READY", storageProvider: "TEST", storageKey: `private-media/${randomUUID()}`, originalFileName: "registration.pdf", declaredMimeType: "application/pdf", detectedMimeType: "application/pdf", byteSize: 12, checksum: marker, createdByUserId: driverOneUserId } });
    await expect(prisma.vehicleDocument.create({ data: { vehicleId: vehicleTwoId, documentType: "REGISTRATION", privateMediaObjectId: media.id, status: "SUBMITTED" } })).rejects.toThrow(/private media object must belong to the linked vehicle/);
  });

  it("allows only the owner to upload/read private vehicle evidence and audits denial", async () => {
    const service = new PrivateMediaService(new LocalPrivateMediaStorageAdapter(root));
    const uploaded = await service.uploadForDriver({ actor: { userId: driverOneUserId, role: UserRole.DRIVER }, vehicleId: vehicleOneId, purpose: PrivateMediaPurpose.VEHICLE_COMPLIANCE_IMAGE, fileName: "front.png", mimeType: "image/png", bytes: png });
    await expect(service.uploadForDriver({ actor: { userId: driverTwoUserId, role: UserRole.DRIVER }, vehicleId: vehicleOneId, purpose: PrivateMediaPurpose.VEHICLE_COMPLIANCE_IMAGE, fileName: "front.png", mimeType: "image/png", bytes: png })).rejects.toMatchObject({ code: "VEHICLE_NOT_FOUND" } satisfies Partial<PrivateMediaPolicyError>);
    const bytes = (await service.read({ actor: { userId: driverOneUserId, role: UserRole.DRIVER }, reference: uploaded.publicReference })).bytes;
    expect(await sharp(bytes).metadata()).toMatchObject({ width: 2, height: 2, format: "png" });
    const decoded = await sharp(bytes).raw().toBuffer();
    expect([...decoded.subarray(0, 3)]).toEqual([10, 20, 30]);
    await expect(service.read({ actor: { userId: driverTwoUserId, role: UserRole.DRIVER }, reference: uploaded.publicReference })).rejects.toMatchObject({ code: "PRIVATE_MEDIA_FORBIDDEN" } satisfies Partial<PrivateMediaPolicyError>);
    const object = await prisma.privateMediaObject.findUniqueOrThrow({ where: { publicReference: uploaded.publicReference } });
    expect(object.checksum).toBe(createHash("sha256").update(bytes).digest("hex"));
    expect(object.metadata).toMatchObject({ sourceChecksum: createHash("sha256").update(png).digest("hex"), rasterNormalization: "PRIVATE_RASTER_V1" });
    await expect(prisma.privateMediaAccessLog.findFirst({ where: { privateMediaObjectId: object.id, actorUserId: driverTwoUserId, outcome: "DENIED" } })).resolves.toBeTruthy();
  });
});
