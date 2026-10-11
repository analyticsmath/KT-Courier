import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { PlatformError, SIZES } from "@/lib/client-platform/contracts";
import { getActiveParcelProfiles, type ActiveParcelProfile } from "./configuration.service";

const dimension = z.number().positive().max(1000);
export const ParcelProfileSchema = z.object({
  stableKey: z.enum(SIZES), displayName: z.string().trim().min(2).max(100),
  lengthCm: dimension, widthCm: dimension, heightCm: dimension,
  maximumWeightKg: z.number().positive().max(10000),
  status: z.enum(["DRAFT", "ACTIVE"]), effectiveFrom: z.iso.datetime(),
  effectiveTo: z.iso.datetime().nullable(), expectedVersion: z.number().int().nonnegative(),
  reason: z.string().trim().min(10).max(500),
}).strict().refine((v) => !v.effectiveTo || v.effectiveTo > v.effectiveFrom, "Effective end must follow start.");

export function usableParcelProfiles(profiles: readonly ActiveParcelProfile[]) {
  // Conflicting effective versions require operator review. Choosing the first
  // would make the accepted limits depend on database sort order.
  return profiles.filter((p) => SIZES.some((s) => s === p.stableKey)
    && profiles.filter((candidate) => candidate.stableKey === p.stableKey).length === 1
    && [p.lengthCm, p.widthCm, p.heightCm].every((v) => v != null && Number.isFinite(Number(v)) && Number(v) > 0 && Number(v) <= 1000)
    && p.maximumWeightKg != null && Number.isFinite(Number(p.maximumWeightKg)) && Number(p.maximumWeightKg) > 0 && Number(p.maximumWeightKg) <= 10000)
    .map((p) => ({ id: p.id, stableKey: p.stableKey, displayName: p.displayName, versionNumber: p.versionNumber, lengthCm: Number(p.lengthCm), widthCm: Number(p.widthCm), heightCm: Number(p.heightCm), maximumWeightKg: Number(p.maximumWeightKg) }));
}

export async function publicParcelProfiles() {
  return usableParcelProfiles(await getActiveParcelProfiles());
}

export async function requireParcelProfile(size: string, weightKg: string) {
  const profile = (await publicParcelProfiles()).find((p) => p.stableKey === size);
  if (!profile) throw new PlatformError("PARCEL_CONFIGURATION_REQUIRED", "Parcel acceptance limits await operational approval. Please contact support.", 409);
  if (!Number.isFinite(Number(weightKg)) || Number(weightKg) <= 0 || Number(weightKg) > profile.maximumWeightKg) throw new PlatformError("WEIGHT_UNSUPPORTED", "Enter a positive weight within the active parcel profile limit.", 422);
  return profile;
}

export async function listParcelProfileVersions() {
  return prisma.parcelProfileVersion.findMany({ where: { stableKey: { in: [...SIZES] } }, orderBy: [{ stableKey: "asc" }, { versionNumber: "desc" }] });
}

export async function saveParcelProfile(actorId: string, input: z.infer<typeof ParcelProfileSchema>) {
  const data = ParcelProfileSchema.parse(input);
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`parcel:${data.stableKey}`}))`;
    const prior = await tx.parcelProfileVersion.findFirst({ where: { stableKey: data.stableKey }, orderBy: { versionNumber: "desc" } });
    if ((prior?.versionNumber ?? 0) !== data.expectedVersion) throw new PlatformError("VERSION_CONFLICT", "Parcel profile changed. Refresh before saving.", 409);
    const closing = data.status === "ACTIVE" ? await tx.parcelProfileVersion.findMany({ where: { stableKey: data.stableKey, status: "ACTIVE", OR: [{ effectiveTo: null }, { effectiveTo: { gt: new Date(data.effectiveFrom) } }] } }) : [];
    if (closing.some((profile) => profile.effectiveFrom >= new Date(data.effectiveFrom))) throw new PlatformError("EFFECTIVE_DATE_CONFLICT", "The new active profile must start after the existing active versions. Review the effective dates.", 409);
    if (data.status === "ACTIVE") {
      await tx.parcelProfileVersion.updateMany({ where: { stableKey: data.stableKey, status: "ACTIVE", OR: [{ effectiveTo: null }, { effectiveTo: { gt: new Date(data.effectiveFrom) } }] }, data: { effectiveTo: new Date(data.effectiveFrom) } });
    }
    const { expectedVersion, reason, ...profile } = data;
    const row = await tx.parcelProfileVersion.create({ data: { ...profile, effectiveFrom: new Date(data.effectiveFrom), effectiveTo: data.effectiveTo ? new Date(data.effectiveTo) : null, versionNumber: expectedVersion + 1, createdByUserId: actorId } });
    await tx.adminActivityLog.create({ data: { actorUserId: actorId, action: "UPDATE", entityType: "ParcelProfileVersion", entityId: row.id, message: reason, metadata: { stableKey: row.stableKey, status: row.status, versionNumber: row.versionNumber, effectiveFrom: row.effectiveFrom.toISOString(), effectiveTo: row.effectiveTo?.toISOString() ?? null, closedVersions: closing.map((profile) => ({ id: profile.id, versionNumber: profile.versionNumber, priorEffectiveTo: profile.effectiveTo?.toISOString() ?? null, effectiveTo: data.effectiveFrom })) } } });
    return row;
  });
}
