import { randomUUID } from "node:crypto";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { attachOwnDriverDocument, completeDriverOnboarding, getDriverProfileByUserId, listOwnDriverDocuments, updateOwnDriverProfile } from "@/lib/services/driver-profile.service";
import type { DriverOnboardingInput } from "@/lib/validation/driver";

describe("driver profile and onboarding on disposable PostgreSQL", () => {
  let userId: string;
  let driverId: string;
  const ownedUsers: string[] = [];
  const ownedDrivers: string[] = [];
  const ownedMedia: string[] = [];
  beforeAll(() => {
    const url = new URL(process.env.DATABASE_URL ?? "postgres://localhost/absent");
    if (process.env.NODE_ENV === "production" || process.env.KT_ALLOW_ISOLATED_POSTGRES_TESTS !== "1" || url.pathname !== "/kt_launch_test" || !["localhost", "127.0.0.1"].includes(url.hostname)) throw new Error("Disposable closure database required.");
  });
  beforeEach(async () => {
    const user = await prisma.user.create({ data: { email: `driver-profile-${randomUUID()}@example.test`, name: "Original driver", phone: "+27820000000", role: "DRIVER", status: "ACTIVE", passwordHash: "disposable-secret-never-in-dto" } });
    userId = user.id; ownedUsers.push(userId);
    const driver = await prisma.driverProfile.create({ data: { userId, driverCode: `DRV-${randomUUID()}`, displayName: user.name, phone: user.phone, internalNotes: "Independent reviewer notes" } });
    driverId = driver.id; ownedDrivers.push(driverId);
  });
  afterEach(async () => {
    await prisma.driverProfile.deleteMany({ where: { id: { in: ownedDrivers } } });
    await prisma.privateMediaObject.deleteMany({ where: { id: { in: ownedMedia } } });
    await prisma.user.deleteMany({ where: { id: { in: ownedUsers } } });
  });
  const input = (): DriverOnboardingInput => ({ displayName: "Updated driver", phone: "+27821112233", idNumber: "DISPOSABLE-PASSPORT", idType: "PASSPORT", dateOfBirth: new Date("1990-01-01T00:00:00Z"), residentialAddress: "Synthetic test address", licenseNumber: "TEST-LICENCE", licenseExpiryDate: new Date("2030-01-01T00:00:00Z"), emergencyContactName: "Test contact", emergencyContactPhone: "+27829998877" });
  const snapshot = async () => ({ user: await prisma.user.findUniqueOrThrow({ where: { id: userId } }), driver: await prisma.driverProfile.findUniqueOrThrow({ where: { id: driverId } }) });
  async function photo(overrides: Partial<{ ownerId: string; purpose: "DRIVER_PROFILE_PHOTO" | "DRIVER_LICENCE" | "DRIVER_IDENTITY_DOCUMENT"; status: "READY" | "PENDING_UPLOAD" }> = {}) {
    const media = await prisma.privateMediaObject.create({ data: { publicReference: `PMO-${randomUUID()}`, ownerType: "DRIVER", ownerId: driverId, purpose: "DRIVER_PROFILE_PHOTO", status: "READY", storageProvider: "local", storageKey: `driver-profile-test/${randomUUID()}`, originalFileName: "headshot.jpg", declaredMimeType: "image/jpeg", detectedMimeType: "image/jpeg", checksum: "a".repeat(64), byteSize: 100, createdByUserId: userId, ...overrides } });
    ownedMedia.push(media.id); return media;
  }
  it("attaches owned licence evidence once, retains replay identity and refuses changed details", async () => {
    const media = await photo({ purpose: "DRIVER_LICENCE" });
    const command = { driverUserId: userId, documentType: "LICENSE" as const, privateMediaReference: media.publicReference, expiresAt: new Date("2030-01-01T00:00:00Z") };
    const before = await snapshot();
    const first = await attachOwnDriverDocument(command);
    expect(first).toMatchObject({ driverProfileId: driverId, status: "SUBMITTED", privateMediaObject: { publicReference: media.publicReference } });
    expect(await attachOwnDriverDocument(command)).toEqual(first);
    await expect(attachOwnDriverDocument({ ...command, expiresAt: null })).rejects.toMatchObject({ code: "MEDIA_ALREADY_ATTACHED" });
    expect(await listOwnDriverDocuments(userId)).toEqual([first]); expect(await snapshot()).toEqual(before);
  });
  it.each(["missing", "foreign", "headshot", "identity-for-licence", "not-ready", "vehicle"] as const)("rejects %s document evidence without replacing the submitted licence", async (kind) => {
    const valid = await photo({ purpose: "DRIVER_LICENCE" });
    const command = { driverUserId: userId, documentType: "LICENSE" as const, privateMediaReference: valid.publicReference };
    const prior = await attachOwnDriverDocument(command);
    const invalid = kind === "missing" ? null : await photo({ purpose: kind === "headshot" ? "DRIVER_PROFILE_PHOTO" : kind === "identity-for-licence" ? "DRIVER_IDENTITY_DOCUMENT" : "DRIVER_LICENCE", ...(kind === "foreign" ? { ownerId: `foreign-${randomUUID()}` } : {}), ...(kind === "not-ready" ? { status: "PENDING_UPLOAD" as const } : {}) });
    await expect(attachOwnDriverDocument({ ...command, privateMediaReference: invalid?.publicReference ?? `PMO-${randomUUID()}`, ...(kind === "vehicle" ? { documentType: "VEHICLE_REGISTRATION" as const } : {}) })).rejects.toMatchObject({ code: "MEDIA_INVALID" });
    expect(await listOwnDriverDocuments(userId)).toEqual([prior]);
  });
  it("serializes concurrent replacements so only one current licence survives", async () => {
    const media = await Promise.all([photo({ purpose: "DRIVER_LICENCE" }), photo({ purpose: "DRIVER_LICENCE" })]);
    const records = await Promise.all(media.map(record => attachOwnDriverDocument({ driverUserId: userId, documentType: "LICENSE", privateMediaReference: record.publicReference })));
    expect(new Set(records.map(record => record.id)).size).toBe(2);
    const saved = await listOwnDriverDocuments(userId);
    expect(saved).toHaveLength(2); expect(saved.filter(record => record.status === "SUBMITTED")).toHaveLength(1);
    expect(saved.filter(record => record.status === "REJECTED")).toMatchObject([{ rejectionReason: "SUPERSEDED_BY_NEW_UPLOAD" }]);
    const superseded = saved.find(record => record.status === "REJECTED")!;
    expect(await attachOwnDriverDocument({ driverUserId: userId, documentType: "LICENSE", privateMediaReference: superseded.privateMediaObject!.publicReference })).toEqual(superseded);
    expect(await listOwnDriverDocuments(userId)).toEqual(saved);
  });
  it("replays concurrent attachment of the same evidence without duplicate documents", async () => {
    const media = await photo({ purpose: "DRIVER_LICENCE" });
    const command = { driverUserId: userId, documentType: "LICENSE" as const, privateMediaReference: media.publicReference };
    const records = await Promise.all([attachOwnDriverDocument(command), attachOwnDriverDocument(command)]);
    expect(records[0]).toEqual(records[1]); expect(await listOwnDriverDocuments(userId)).toEqual([records[0]]);
  });
  it.each(["ID_DOCUMENT", "PROOF_OF_ADDRESS", "OTHER"] as const)("attaches intended identity evidence for %s without approving the driver", async (documentType) => {
    const media = await photo({ purpose: "DRIVER_IDENTITY_DOCUMENT" }); const before = await snapshot();
    const record = await attachOwnDriverDocument({ driverUserId: userId, documentType, privateMediaReference: media.publicReference });
    expect(record).toMatchObject({ documentType, status: "SUBMITTED", privateMediaObjectId: media.id });
    expect(await snapshot()).toEqual(before);
  });
  it("rolls back supersession when creating the replacement document fails", async () => {
    const original = await photo({ purpose: "DRIVER_LICENCE" }); const replacement = await photo({ purpose: "DRIVER_LICENCE" });
    const command = { driverUserId: userId, documentType: "LICENSE" as const };
    const prior = await attachOwnDriverDocument({ ...command, privateMediaReference: original.publicReference });
    const identifier = `closure_document_${randomUUID().replaceAll("-", "")}`;
    await prisma.$executeRawUnsafe(`CREATE FUNCTION "${identifier}"() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."driverProfileId" = '${driverId}' THEN RAISE EXCEPTION 'DISPOSABLE_DOCUMENT_WRITE_FAILURE'; END IF; RETURN NEW; END $$`);
    try {
      await prisma.$executeRawUnsafe(`CREATE TRIGGER "${identifier}" BEFORE INSERT ON "DriverDocument" FOR EACH ROW EXECUTE FUNCTION "${identifier}"()`);
      await expect(attachOwnDriverDocument({ ...command, privateMediaReference: replacement.publicReference })).rejects.toThrow("DISPOSABLE_DOCUMENT_WRITE_FAILURE");
      expect(await listOwnDriverDocuments(userId)).toEqual([prior]);
    } finally {
      await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS "${identifier}" ON "DriverDocument"`);
      await prisma.$executeRawUnsafe(`DROP FUNCTION "${identifier}"()`);
    }
  });
  it("returns synchronized account/profile fields without review notes or password data", async () => {
    const result = await updateOwnDriverProfile(userId, { displayName: "Updated driver", phone: "+27821112233", emergencyContactName: "Test contact" });
    expect(result).toMatchObject({ displayName: "Updated driver", phone: "+27821112233", user: { name: "Updated driver", phone: "+27821112233" } });
    expect(result).not.toHaveProperty("internalNotes"); expect(result.user).not.toHaveProperty("passwordHash");
    expect((await snapshot()).driver.internalNotes).toBe("Independent reviewer notes");
  });
  it("keeps an explicitly cleared display name synchronized", async () => {
    const result = await updateOwnDriverProfile(userId, { displayName: "" });
    expect(result.displayName).toBe(""); expect(result.user.name).toBe("");
  });
  it("submits typed identity and owned photo for review without approving the driver", async () => {
    const media = await photo(); const result = await completeDriverOnboarding(userId, { ...input(), profilePhotoMediaReference: media.publicReference });
    expect(result).toMatchObject({ idNumber: "DISPOSABLE-PASSPORT", idType: "PASSPORT", profilePhotoMediaId: media.id, profilePhotoMediaReference: media.publicReference, onboardingStatus: "PENDING_REVIEW", status: "PENDING_REVIEW", availability: "OFFLINE", user: { name: "Updated driver", phone: "+27821112233" } });
    const saved = (await snapshot()).driver;
    expect(saved.internalNotes).toBe("Independent reviewer notes"); expect(saved.active).toBe(false); expect(saved.approvedAt).toBeNull(); expect(saved.vehicleComplianceRequiredAt).not.toBeNull();
    expect(result).not.toHaveProperty("internalNotes"); expect(result.user).not.toHaveProperty("passwordHash");
  });
  it("preserves the canonical photo reference across reload and onboarding resubmission", async () => {
    const media = await photo();
    await completeDriverOnboarding(userId, { ...input(), profilePhotoMediaReference: media.publicReference });
    const reloaded = await getDriverProfileByUserId(userId);
    expect(reloaded?.profilePhotoMediaReference).toBe(media.publicReference);
    expect(reloaded?.profilePhotoMediaReference).not.toBe(`PMO-${media.id}`);
    const result = await completeDriverOnboarding(userId, { ...input(), profilePhotoMediaReference: reloaded!.profilePhotoMediaReference! });
    expect(result.profilePhotoMediaReference).toBe(media.publicReference);
    expect((await snapshot()).driver.internalNotes).toBe("Independent reviewer notes");
  });
  it.each(["missing", "foreign", "wrong-purpose", "not-ready"] as const)("rejects %s photo before writing account or onboarding fields", async (kind) => {
    let reference = `PMO-${randomUUID()}`;
    if (kind !== "missing") {
      const overrides = kind === "foreign" ? { ownerId: `foreign-${randomUUID()}` } : kind === "wrong-purpose" ? { purpose: "DRIVER_LICENCE" as const } : { status: "PENDING_UPLOAD" as const };
      const media = await photo(overrides); reference = media.publicReference;
    }
    const before = await snapshot();
    await expect(completeDriverOnboarding(userId, { ...input(), profilePhotoMediaReference: reference })).rejects.toThrow("cannot be used as a driver profile photo");
    expect(await snapshot()).toEqual(before);
  });
  it.each(["profile", "onboarding"] as const)("rolls back the account update when the %s profile write fails", async (command) => {
    const before = await snapshot();
    const identifier = `closure_driver_${randomUUID().replaceAll("-", "")}`;
    // A test-owned trigger faults only this synthetic driver. Identifiers are
    // generated hex; the target value is a database-generated cuid. No supplied
    // SQL or production connection is used. Both objects are removed in finally.
    await prisma.$executeRawUnsafe(`CREATE FUNCTION "${identifier}"() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF OLD.id = '${driverId}' THEN RAISE EXCEPTION 'DISPOSABLE_DRIVER_WRITE_FAILURE'; END IF; RETURN NEW; END $$`);
    try {
      await prisma.$executeRawUnsafe(`CREATE TRIGGER "${identifier}" BEFORE UPDATE ON "DriverProfile" FOR EACH ROW EXECUTE FUNCTION "${identifier}"()`);
      await expect(command === "profile" ? updateOwnDriverProfile(userId, { displayName: "Rejected update", phone: "+27824445566" }) : completeDriverOnboarding(userId, input())).rejects.toThrow("DISPOSABLE_DRIVER_WRITE_FAILURE");
      expect(await snapshot()).toEqual(before);
    } finally {
      await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS "${identifier}" ON "DriverProfile"`);
      await prisma.$executeRawUnsafe(`DROP FUNCTION "${identifier}"()`);
    }
  });
});
