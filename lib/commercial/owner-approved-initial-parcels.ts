import { prisma } from "@/lib/db/prisma";
import { saveParcelProfile } from "@/lib/commercial/parcel-profiles";
import { INITIAL_CLIENT_PARCEL_DRAFTS } from "@/lib/commercial/initial-client-parcel-drafts";

/**
 * The owner explicitly approved the initial parcel limits on 2026-10-13.
 * A separate exact-value production flag is required before changing any records.
 */
export const OWNER_PARCEL_LIMITS_APPROVAL = "OWNER_APPROVED_2026_10_13_SMALL_MEDIUM_LARGE";

type ParcelVersion = {
  stableKey: string;
  versionNumber: number;
  status: string;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  lengthCm: unknown;
  widthCm: unknown;
  heightCm: unknown;
  maximumWeightKg: unknown;
};

export function planInitialParcelActivation(rows: readonly ParcelVersion[], now: Date) {
  return INITIAL_CLIENT_PARCEL_DRAFTS.flatMap((draft) => {
    const versions = rows
      .filter((row) => row.stableKey === draft.stableKey)
      .sort((a, b) => b.versionNumber - a.versionNumber);
    const matches = (row: ParcelVersion) =>
      Number(row.lengthCm) === draft.lengthCm &&
      Number(row.widthCm) === draft.widthCm &&
      Number(row.heightCm) === draft.heightCm &&
      Number(row.maximumWeightKg) === draft.maximumWeightKg;
    const active = versions.filter((row) =>
      row.status === "ACTIVE" &&
      row.effectiveFrom <= now &&
      (row.effectiveTo === null || row.effectiveTo > now),
    );

    if (active.length > 1) {
      throw new Error(`Multiple effective active ${draft.stableKey} profiles require manual operator reconciliation.`);
    }
    if (active.length === 1) {
      if (!matches(active[0])) {
        throw new Error(`Existing approved ${draft.stableKey} limits differ from the owner's initial limits. No automatic overwrite.`);
      }
      return [];
    }
    const latest = versions[0];
    if (latest && (latest.status !== "DRAFT" || !matches(latest))) {
      throw new Error(`Latest ${draft.stableKey} profile is not the unchanged client draft. Requires explicit administrator review.`);
    }
    return [{ ...draft, expectedVersion: latest?.versionNumber ?? 0 }];
  });
}

export async function activateOwnerApprovedInitialParcelProfiles(actorId: string) {
  const now = new Date();
  const versions = await prisma.parcelProfileVersion.findMany({
    where: { stableKey: { in: INITIAL_CLIENT_PARCEL_DRAFTS.map((draft) => draft.stableKey) } },
    orderBy: [{ stableKey: "asc" }, { versionNumber: "desc" }],
  });
  // Calculate every change before the first write to prevent partial activation on
  // mismatching or already-approved operator limits. Save uses an advisory lock
  // and expected version to protect concurrent administrator changes.
  const plan = planInitialParcelActivation(versions, now);
  for (const draft of plan) {
    await saveParcelProfile(actorId, {
      stableKey: draft.stableKey,
      expectedVersion: draft.expectedVersion,
      displayName: draft.displayName,
      lengthCm: draft.lengthCm,
      widthCm: draft.widthCm,
      heightCm: draft.heightCm,
      maximumWeightKg: draft.maximumWeightKg,
      status: "ACTIVE",
      effectiveFrom: now.toISOString(),
      effectiveTo: null,
      reason: "Owner approved initial parcel limits in chat on 2026-10-13; automated maintenance activation of unchanged draft, with audit and version control.",
    });
  }
  return { activated: plan.map((draft) => draft.stableKey), alreadyApproved: INITIAL_CLIENT_PARCEL_DRAFTS.length - plan.length };
}
