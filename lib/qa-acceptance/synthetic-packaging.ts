import { QaAcceptanceRole, QaAcceptanceRunStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { resolveQaAcceptanceLaneConfig } from "./config";
import {
  actOnTrustedPackageVersion,
  listTrustedPackageVersionsSafely,
  saveTrustedPackageVersion,
} from "@/lib/marketplace-checkout/parcel-configuration.service";
import { recordAdminActivity } from "@/lib/services/admin-activity.service";

export class QaPackagingError extends Error {
  constructor(
    readonly code:
      | "QA_INVALID_INPUT"
      | "QA_NOT_FOUND"
      | "QA_CONFIG_UNAVAILABLE"
      | "QA_ISOLATION_VIOLATION"
      | "QA_CONFLICT",
    message: string,
  ) {
    super(message);
    this.name = "QaPackagingError";
  }
}

export async function recordQaSyntheticPackageDraft(input: Readonly<{
  actorUserId: string;
  runId: string;
  storeId: string;
  offerReference: string;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
  weightKg: number;
  reason: string;
}>) {
  const config = resolveQaAcceptanceLaneConfig();
  if (!config.eligible) {
    throw new QaPackagingError("QA_CONFIG_UNAVAILABLE", config.reason);
  }

  const [run, store, vendorPrincipal, offer] = await Promise.all([
    prisma.qaAcceptanceRun.findUnique({ where: { id: input.runId } }),
    prisma.store.findUnique({
      where: { id: input.storeId },
      select: { id: true, name: true, status: true, isQaAcceptance: true },
    }),
    prisma.qaAcceptancePrincipal.findFirst({
      where: { storeId: input.storeId, role: QaAcceptanceRole.VENDOR, active: true, revokedAt: null },
      select: { id: true },
    }),
    prisma.storeCatalogOffer.findUnique({
      where: { publicReference: input.offerReference },
      include: {
        variant: { select: { publicReference: true } },
        modifierGroups: {
          include: {
            group: {
              include: {
                options: { where: { status: "ACTIVE" }, orderBy: [{ displayOrder: "asc" }, { id: "asc" }] },
              },
            },
          },
          orderBy: [{ displayOrder: "asc" }, { groupId: "asc" }],
        },
      },
    }),
  ]);

  if (!run || run.status !== QaAcceptanceRunStatus.ACTIVE) {
    throw new QaPackagingError("QA_ISOLATION_VIOLATION", "An active QA acceptance run is required to record QA synthetic packaging.");
  }
  if (!store?.isQaAcceptance || !vendorPrincipal) {
    throw new QaPackagingError("QA_ISOLATION_VIOLATION", "Synthetic QA packaging is restricted strictly to actively enrolled QA stores.");
  }
  if (run.storeId && run.storeId !== store.id) {
    throw new QaPackagingError("QA_ISOLATION_VIOLATION", "Target QA store does not match the selected QA acceptance run.");
  }
  if (!offer || offer.storeId !== store.id || offer.status !== "ACTIVE" || offer.publicationStatus !== "PUBLISHED") {
    throw new QaPackagingError("QA_INVALID_INPUT", "Offer must be ACTIVE and PUBLISHED on the enrolled QA store before recording QA packaging.");
  }

  const modifiers = offer.modifierGroups
    .filter((link) => link.group.status === "ACTIVE")
    .flatMap((link) => {
      const min = Math.max(link.group.isRequired ? 1 : 0, link.group.minimumSelections);
      return min > 0 && link.group.options[0]
        ? [{ optionReference: link.group.options[0].publicReference, quantity: min }]
        : [];
    });

  const { versions } = await listTrustedPackageVersionsSafely();
  const latestVersion = Math.max(0, ...versions.map((v) => v.version));
  const currentActiveOrDraft = [...versions]
    .filter((v) => v.status !== "RETIRED")
    .sort((a, b) => b.version - a.version)[0];

  const entry = {
    storeId: store.id,
    offerReference: offer.publicReference,
    variantReference: offer.variant.publicReference,
    publicationVersion: String(offer.version),
    modifiers,
    packingRule: "SINGLE_PREPACKAGED_UNIT" as const,
    lengthCm: input.lengthCm,
    widthCm: input.widthCm,
    heightCm: input.heightCm,
    weightKg: input.weightKg,
    authorityReference: `qa-synthetic-pkg:${run.publicReference}:${offer.publicReference}:v${offer.version}`,
    qaScope: {
      qaAcceptanceOnly: true as const,
      runReference: run.publicReference,
      storeId: store.id,
    },
  };

  const entryKey = (pkg: {
    storeId: string;
    offerReference: string;
    variantReference: string;
    modifiers: ReadonlyArray<{ optionReference: string; quantity: number }>;
  }) =>
    JSON.stringify({
      storeId: pkg.storeId,
      offerReference: pkg.offerReference,
      variantReference: pkg.variantReference,
      modifiers: [...pkg.modifiers].sort((a, b) => a.optionReference.localeCompare(b.optionReference)),
    });

  const entryTargetKey = entryKey(entry);
  const candidatePriorPackages = (currentActiveOrDraft?.packages ?? []).filter(
    (prior) => entryKey(prior) !== entryTargetKey,
  );
  const priorOfferRefs = [...new Set(candidatePriorPackages.map((p) => p.offerReference))];
  const priorOfferRows = priorOfferRefs.length
    ? await prisma.storeCatalogOffer.findMany({
        where: { publicReference: { in: priorOfferRefs } },
        select: {
          publicReference: true,
          storeId: true,
          status: true,
          publicationStatus: true,
          version: true,
          variant: { select: { publicReference: true } },
          publicationSnapshots: { where: { status: "PUBLISHED" }, take: 1, select: { id: true } },
        },
      })
    : [];
  const priorOfferMap = new Map(priorOfferRows.map((o) => [o.publicReference, o]));
  const preservedPackages = candidatePriorPackages.filter((prior) => {
    const src = priorOfferMap.get(prior.offerReference);
    return Boolean(
      src &&
        src.status === "ACTIVE" &&
        src.publicationStatus === "PUBLISHED" &&
        src.storeId === prior.storeId &&
        src.variant.publicReference === prior.variantReference &&
        String(src.version) === prior.publicationVersion &&
        src.publicationSnapshots.length === 1,
    );
  });
  const prunedStaleEntriesCount = candidatePriorPackages.length - preservedPackages.length;

  const created = await saveTrustedPackageVersion(input.actorUserId, {
    expectedVersion: latestVersion,
    effectiveFrom: new Date(Date.now() - 60_000).toISOString(),
    effectiveTo: null,
    packages: [...preservedPackages, entry],
    bundles: currentActiveOrDraft?.bundles ?? [],
    reason: `[QA_SYNTHETIC:${run.publicReference}] ${input.reason.trim()}`,
  });

  await recordAdminActivity({
    actorUserId: input.actorUserId,
    action: "CREATE",
    entityType: "QaSyntheticPackaging",
    entityId: `${store.id}:${offer.publicReference}:v${created.version}`,
    message: `Recorded QA synthetic package draft v${created.version} for ${offer.publicReference} (${input.lengthCm}x${input.widthCm}x${input.heightCm} cm, ${input.weightKg} kg)`,
    metadata: {
      runReference: run.publicReference,
      storeId: store.id,
      offerReference: offer.publicReference,
      offerVersion: offer.version,
      packageVersion: created.version,
      prunedStaleEntriesCount,
      qaAcceptanceOnly: true,
    },
  });

  const updatedAt = await readTrustedPackageUpdatedAt(created.version);
  return { ...created, updatedAt };
}

async function readTrustedPackageUpdatedAt(version: number): Promise<string> {
  const row = await prisma.systemSetting.findUniqueOrThrow({
    where: { key: `production_marketplace_trusted_packages_v${version}` },
    select: { updatedAt: true },
  });
  return row.updatedAt.toISOString();
}

export async function reviewAndActivateQaSyntheticPackaging(input: Readonly<{
  actorUserId: string;
  version: number;
  expectedUpdatedAt: string;
  action: "APPROVE" | "ACTIVATE";
  reason: string;
}>) {
  const config = resolveQaAcceptanceLaneConfig();
  if (!config.eligible) {
    throw new QaPackagingError("QA_CONFIG_UNAVAILABLE", config.reason);
  }

  const { versions } = await listTrustedPackageVersionsSafely();
  const target = versions.find((v) => v.version === input.version);
  if (!target) {
    throw new QaPackagingError("QA_NOT_FOUND", `Trusted package version ${input.version} was not found.`);
  }
  const previous = versions
    .filter((v) => v.version < input.version && v.status !== "RETIRED")
    .sort((a, b) => b.version - a.version)[0];
  const prevSerialized = new Set((previous?.packages ?? []).map((p) => JSON.stringify(p)));
  const introducedEntries = target.packages.filter((p) => !prevSerialized.has(JSON.stringify(p)));
  const targetsToVerify = introducedEntries.length > 0 ? introducedEntries : target.packages;

  const storeIds = [...new Set(targetsToVerify.map((p) => p.storeId))];
  const stores = await prisma.store.findMany({
    where: { id: { in: storeIds } },
    select: { id: true, isQaAcceptance: true },
  });
  const qaStoreSet = new Set(stores.filter((s) => s.isQaAcceptance).map((s) => s.id));
  for (const entry of targetsToVerify) {
    if (
      !qaStoreSet.has(entry.storeId) ||
      (!entry.qaScope?.qaAcceptanceOnly && !entry.authorityReference.startsWith("qa-synthetic-pkg:"))
    ) {
      throw new QaPackagingError(
        "QA_ISOLATION_VIOLATION",
        "QA packaging review endpoint may only approve/activate versions containing strictly QA-scoped synthetic packages on enrolled QA stores.",
      );
    }
  }

  const acted = await actOnTrustedPackageVersion(input.actorUserId, {
    version: input.version,
    expectedUpdatedAt: input.expectedUpdatedAt,
    action: input.action,
    reason: `[QA_SYNTHETIC_REVIEW] ${input.reason.trim()}`,
  });
  const updatedAt = await readTrustedPackageUpdatedAt(acted.version);
  return { ...acted, updatedAt };
}
