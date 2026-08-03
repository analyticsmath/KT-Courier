import { prisma } from "@/lib/db/prisma";
import { StorefrontProjectionService } from "@/lib/services/storefront-projection.service";

type ProjectionCase = Readonly<{ id: string; publicReference: string; aggregateType: string; aggregateReference: string; reason: string; status: "OPEN" | "OBSERVED" | "RESOLVED"; version: number; observationCount: number; safeSummary: string; openedAt: Date; lastObservedAt: Date; resolvedAt: Date | null; resolutionCode: string | null }>;
type ReconciliationDb = {
  storefrontProjectionCase: { findUnique(args: unknown): Promise<ProjectionCase | null>; findMany(args: unknown): Promise<ProjectionCase[]>; updateMany(args: unknown): Promise<{ count: number }> };
};
function asDb(value: unknown): ReconciliationDb { return value as ReconciliationDb; }

export class StorefrontReconciliationError extends Error {
  constructor(readonly code: string, message: string) { super(message); this.name = "StorefrontReconciliationError"; }
}

/** Reconciliation can only request the canonical projection builder; no public field override is available. */
export class StorefrontReconciliationService {
  constructor(private readonly db: ReconciliationDb = asDb(prisma), private readonly projections = new StorefrontProjectionService()) {}

  async list() { return this.db.storefrontProjectionCase.findMany({ orderBy: [{ lastObservedAt: "desc" }, { publicReference: "asc" }], take: 100 }); }

  async inspect(publicReference: string) {
    const value = await this.db.storefrontProjectionCase.findUnique({ where: { publicReference } });
    if (!value) throw new StorefrontReconciliationError("PROJECTION_CASE_NOT_FOUND", "The projection case is unavailable.");
    return value;
  }

  async requestCanonicalRebuild(publicReference: string, version: number) {
    const value = await this.inspect(publicReference);
    if (value.version !== version) throw new StorefrontReconciliationError("PROJECTION_CASE_VERSION_CONFLICT", "This projection case has changed. Reload it before requesting a rebuild.");
    if (value.status === "RESOLVED") throw new StorefrontReconciliationError("PROJECTION_CASE_RESOLVED", "Historical projection cases cannot be reopened by override.");
    if (value.aggregateType !== "SNAPSHOT") throw new StorefrontReconciliationError("CANONICAL_REBUILD_UNAVAILABLE", "This case requires correction through its canonical source event, not a manual public edit.");
    await this.projections.buildPublishedSnapshot(value.aggregateReference);
    return this.inspect(publicReference);
  }

  async resolveAfterCanonicalRebuild(publicReference: string, version: number, actorUserId: string) {
    const value = await this.requestCanonicalRebuild(publicReference, version);
    const update = await this.db.storefrontProjectionCase.updateMany({ where: { id: value.id, version: value.version, status: { in: ["OPEN", "OBSERVED"] } }, data: { status: "RESOLVED", version: { increment: 1 }, resolvedAt: new Date(), resolutionCode: "CANONICAL_PROJECTION_REBUILT", safeSummary: "Canonical snapshot projection completed before reconciliation resolution.", resolvedByUserId: actorUserId } });
    if (!update.count) throw new StorefrontReconciliationError("PROJECTION_CASE_RESOLUTION_CONFLICT", "The projection case changed before it could be resolved.");
    return this.inspect(publicReference);
  }
}
