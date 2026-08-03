import { catalogPublicReference } from "@/lib/catalog/catalog-normalization";
import {
  assertStorefrontEditorialTransition,
  normaliseStorefrontSynonymTerms,
  type StorefrontEditorialStatus,
  type StorefrontSynonymTerm,
} from "@/lib/storefront/storefront-editorial-policy";
import { prisma } from "@/lib/db/prisma";
import { Prisma } from "@prisma/client";

type SynonymRow = Readonly<{ id: string; publicReference: string; name: string; versionNumber: number; version: number; status: StorefrontEditorialStatus; language: string; terms: unknown; createdByUserId: string; approvedByUserId: string | null; activatedAt: Date | null; retiredAt: Date | null; createdAt: Date; updatedAt: Date }>;
type StorefrontSynonymDb = {
  $transaction<T>(callback: (tx: StorefrontSynonymDb) => Promise<T>): Promise<T>;
  storefrontSearchSynonymSet: { create(args: unknown): Promise<SynonymRow>; findUnique(args: unknown): Promise<SynonymRow | null>; findMany(args: unknown): Promise<SynonymRow[]>; updateMany(args: unknown): Promise<{ count: number }>; };
  storefrontSearchSynonymHistory: { create(args: unknown): Promise<unknown> };
};
function asDb(value: unknown): StorefrontSynonymDb { return value as StorefrontSynonymDb; }

export class StorefrontSynonymError extends Error {
  constructor(readonly code: string, message: string) { super(message); this.name = "StorefrontSynonymError"; }
}
function transitionTarget(action: "submit" | "approve" | "reject" | "activate" | "retire"): StorefrontEditorialStatus { return ({ submit: "UNDER_REVIEW", approve: "APPROVED", reject: "REJECTED", activate: "ACTIVE", retire: "RETIRED" } as const)[action]; }
function assertDraft(record: SynonymRow) { if (record.status !== "DRAFT") throw new StorefrontSynonymError("SYNONYM_IMMUTABLE", "Only draft synonym versions may be edited."); }
function assertVersion(record: SynonymRow, version: number) { if (record.version !== version) throw new StorefrontSynonymError("SYNONYM_VERSION_CONFLICT", "This synonym version has changed. Reload it before editing."); }
function plainTerms(value: unknown): StorefrontSynonymTerm[] { return normaliseStorefrontSynonymTerms(Array.isArray(value) ? value as { input: string; outputs: string[]; direction: "EQUIVALENT" | "ONE_WAY" }[] : []); }

export class StorefrontSynonymService {
  constructor(private readonly db: StorefrontSynonymDb = asDb(prisma)) {}

  async list() { return this.db.storefrontSearchSynonymSet.findMany({ orderBy: [{ name: "asc" }, { language: "asc" }, { versionNumber: "desc" }], take: 100 }); }
  async get(publicReference: string) { return this.db.storefrontSearchSynonymSet.findUnique({ where: { publicReference } }); }

  async create(input: Readonly<{ name: string; language: string; terms: StorefrontSynonymTerm[]; actorUserId: string; operationId: string }>) {
    const terms = normaliseStorefrontSynonymTerms(input.terms);
    return this.db.$transaction(async (tx) => {
      const versions = await tx.storefrontSearchSynonymSet.findMany({ where: { name: input.name, language: input.language }, orderBy: { versionNumber: "desc" }, take: 1 });
      const record = await tx.storefrontSearchSynonymSet.create({ data: { publicReference: catalogPublicReference("SSS"), name: input.name, language: input.language, versionNumber: (versions[0]?.versionNumber ?? 0) + 1, terms, createdByUserId: input.actorUserId } });
      await tx.storefrontSearchSynonymHistory.create({ data: { synonymSetId: record.id, fromStatus: null, toStatus: "DRAFT", actorUserId: input.actorUserId, operationId: input.operationId, safeSummary: "Deterministic synonym draft was created." } });
      return record;
    });
  }

  async update(publicReference: string, input: Readonly<{ version: number; terms: StorefrontSynonymTerm[]; actorUserId: string; operationId: string }>) {
    const record = await this.require(publicReference); assertDraft(record); assertVersion(record, input.version);
    const terms = normaliseStorefrontSynonymTerms(input.terms);
    const updated = await this.db.storefrontSearchSynonymSet.updateMany({ where: { id: record.id, version: input.version, status: "DRAFT" }, data: { terms, version: { increment: 1 } } });
    if (!updated.count) throw new StorefrontSynonymError("SYNONYM_VERSION_CONFLICT", "This synonym version has changed. Reload it before editing.");
    return this.require(publicReference);
  }

  async transition(publicReference: string, action: "submit" | "approve" | "reject" | "activate" | "retire", input: Readonly<{ version: number; actorUserId: string; operationId: string }>) {
    const record = await this.require(publicReference); assertVersion(record, input.version);
    const toStatus = transitionTarget(action); assertStorefrontEditorialTransition(record.status, toStatus);
    const terms = plainTerms(record.terms);
    if (!terms.length) throw new StorefrontSynonymError("INVALID_SYNONYM_SET", "A synonym version requires deterministic terms.");
    return this.db.$transaction(async (tx) => {
      if (toStatus === "ACTIVE") {
        const active = await tx.storefrontSearchSynonymSet.findMany({ where: { name: record.name, language: record.language, status: "ACTIVE" }, take: 2 });
        // Active versions are immutable historical evidence. Retire a prior active
        // version in the same reviewed transaction before activating this one.
        for (const prior of active) {
          await tx.storefrontSearchSynonymSet.updateMany({ where: { id: prior.id, status: "ACTIVE" }, data: { status: "RETIRED", retiredAt: new Date(), version: { increment: 1 } } });
          await tx.storefrontSearchSynonymHistory.create({ data: { synonymSetId: prior.id, fromStatus: "ACTIVE", toStatus: "RETIRED", actorUserId: input.actorUserId, operationId: `${input.operationId}:retire:${prior.publicReference}`.slice(0, 160), safeSummary: "Prior active synonym version was retired before reviewed successor activation." } });
        }
      }
      const update = await tx.storefrontSearchSynonymSet.updateMany({ where: { id: record.id, version: record.version, status: record.status }, data: { status: toStatus, ...(toStatus === "APPROVED" ? { approvedByUserId: input.actorUserId } : {}), ...(toStatus === "ACTIVE" ? { activatedAt: new Date() } : {}), ...(toStatus === "RETIRED" ? { retiredAt: new Date() } : {}), version: { increment: 1 } } });
      if (!update.count) throw new StorefrontSynonymError("SYNONYM_VERSION_CONFLICT", "This synonym version has changed. Reload it before editing.");
      await tx.storefrontSearchSynonymHistory.create({ data: { synonymSetId: record.id, fromStatus: record.status, toStatus, actorUserId: input.actorUserId, operationId: input.operationId, safeSummary: `Synonym version moved from ${record.status} to ${toStatus} through reviewed lifecycle control.` } });
      return this.require(publicReference);
    });
  }

  private async require(publicReference: string): Promise<SynonymRow> {
    const record = await this.get(publicReference);
    if (!record) throw new StorefrontSynonymError("SYNONYM_NOT_FOUND", "The synonym version is unavailable.");
    return record;
  }
}

/** Loads only reviewed active versions. It intentionally has no AI, SQL, or regex rule path. */
export async function loadActiveStorefrontSynonymTerms(): Promise<StorefrontSynonymTerm[]> {
  const rows = await prisma.$queryRaw<Array<{ terms: unknown }>>(Prisma.sql`SELECT "terms" FROM "StorefrontSearchSynonymSet" WHERE "status" = 'ACTIVE' ORDER BY "name" ASC, "versionNumber" DESC LIMIT 100`);
  return rows.flatMap((row) => {
    try { return plainTerms(row.terms); } catch { return []; }
  }).slice(0, 96);
}
