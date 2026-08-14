import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { LocalPrivateMediaStorageAdapter } from "@/lib/private-media/private-media-storage";
import { PrivateMediaPolicyError, PrivateMediaService } from "@/lib/private-media/private-media.service";
import { PrivateMediaOwnerType, PrivateMediaPurpose, UserRole, UserStatus, VehicleType } from "@/types/db";

const marker = randomUUID();
const rootPromise = mkdtemp(path.join(os.tmpdir(), "kt-phase-b-private-media-"));
const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]);
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
  const root = await rootPromise;
  await prisma.vehicleDocument.deleteMany({ where: { vehicle: { driverProfile: { driverCode: { startsWith: `PB-${marker.slice(0, 8)}` } } } } });
  await prisma.vehicleMedia.deleteMany({ where: { vehicle: { driverProfile: { driverCode: { startsWith: `PB-${marker.slice(0, 8)}` } } } } });
  await prisma.privateMediaObject.deleteMany({ where: { publicReference: { startsWith: "PMO-" }, createdByUserId: { in: [driverOneUserId, driverTwoUserId] } } });
  await prisma.vehicle.deleteMany({ where: { id: { in: [vehicleOneId, vehicleTwoId] } } });
  await prisma.driverProfile.deleteMany({ where: { id: { in: [driverOneProfileId, driverTwoProfileId] } } });
  await prisma.user.deleteMany({ where: { id: { in: [driverOneUserId, driverTwoUserId] } } });
  await rm(root, { recursive: true, force: true });
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
    const root = await rootPromise;
    const service = new PrivateMediaService(new LocalPrivateMediaStorageAdapter(root));
    const uploaded = await service.uploadForDriver({ actor: { userId: driverOneUserId, role: UserRole.DRIVER }, vehicleId: vehicleOneId, purpose: PrivateMediaPurpose.VEHICLE_COMPLIANCE_IMAGE, fileName: "front.png", mimeType: "image/png", bytes: png });
    await expect(service.uploadForDriver({ actor: { userId: driverTwoUserId, role: UserRole.DRIVER }, vehicleId: vehicleOneId, purpose: PrivateMediaPurpose.VEHICLE_COMPLIANCE_IMAGE, fileName: "front.png", mimeType: "image/png", bytes: png })).rejects.toMatchObject({ code: "VEHICLE_NOT_FOUND" } satisfies Partial<PrivateMediaPolicyError>);
    expect(Array.from((await service.read({ actor: { userId: driverOneUserId, role: UserRole.DRIVER }, reference: uploaded.publicReference })).bytes)).toEqual(Array.from(png));
    await expect(service.read({ actor: { userId: driverTwoUserId, role: UserRole.DRIVER }, reference: uploaded.publicReference })).rejects.toMatchObject({ code: "PRIVATE_MEDIA_FORBIDDEN" } satisfies Partial<PrivateMediaPolicyError>);
    const object = await prisma.privateMediaObject.findUniqueOrThrow({ where: { publicReference: uploaded.publicReference } });
    await expect(prisma.privateMediaAccessLog.findFirst({ where: { privateMediaObjectId: object.id, actorUserId: driverTwoUserId, outcome: "DENIED" } })).resolves.toBeTruthy();
  });
});
