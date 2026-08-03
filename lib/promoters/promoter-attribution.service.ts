/* eslint-disable @typescript-eslint/no-explicit-any -- Prisma client generation is deferred to Phase 26.5. */
import { randomUUID } from "node:crypto";
import { PromoterError } from "./errors";
import { assertExactlyOneAttributionSubject } from "./policy";
import { assertPromotersProductionReady } from "./production-readiness";
type Db = any;

/** First-valid-touch binding. This service has no operation to overwrite an attribution. */
export class PromoterAttributionService {
  constructor(private readonly db: Db) {}
  async bind(input: Readonly<{ promoterAccountId: string; enrollmentId: string; programVersionId: string; touchId: string; subjectType: "CUSTOMER" | "BUSINESS_CUSTOMER" | "STORE"; subjectKey: string; customerUserId?: string; businessAccountId?: string; storeId?: string; expiresAt: Date; operationId: string; requestHash: string }>) {
    assertPromotersProductionReady(); assertExactlyOneAttributionSubject(input);
    const touch = await this.db.promoterTouch.findUnique({ where: { id: input.touchId }, include: { promoterAccount: true, enrollment: true } });
    if (!touch || touch.validityStatus !== "VALID" || touch.promoterAccount.status !== "ACTIVE" || touch.enrollment.status !== "ACTIVE" || touch.programVersionId !== input.programVersionId) throw new PromoterError("PROMOTER_NOT_ELIGIBLE", "A valid active promoter touch is required.");
    const existing = await this.db.promoterAttribution.findUnique({ where: { programVersionId_subjectKey: { programVersionId: input.programVersionId, subjectKey: input.subjectKey } } });
    if (existing) {
      if (existing.operationId === input.operationId && existing.requestHash === input.requestHash) return Object.freeze({ ...existing, replayed: true });
      throw new PromoterError("PROMOTER_ATTRIBUTION_CONFLICT", "Acquisition attribution is immutable and cannot be replaced.");
    }
    return this.db.promoterAttribution.create({ data: { ...input, publicReference: `PAT-${randomUUID().replaceAll("-", "").toUpperCase()}`, status: "ATTRIBUTED", attributionModel: "FIRST_VALID_ACQUISITION_TOUCH" } });
  }
}
