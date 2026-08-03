/* eslint-disable @typescript-eslint/no-explicit-any -- Prisma client generation is deferred to Phase 26.5. */
import { randomUUID } from "node:crypto";
import { PromoterError } from "./errors";
import { assertPromoterActivationEligibility } from "./policy";
import { assertPromotersProductionReady } from "./production-readiness";

type Db = any;
const operation = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,119}$/;
const reference = () => `PRA-${randomUUID().replaceAll("-", "").toUpperCase()}`;

/** Durable repository-backed account lifecycle; no customer referral entry point exists. */
export class PromoterAccountService {
  constructor(private readonly db: Db) {}
  async apply(input: Readonly<{ userId: string; legalName: string; displayName?: string; operationId: string; requestHash: string }>) {
    assertPromotersProductionReady();
    if (!operation.test(input.operationId) || !input.userId || !input.legalName.trim()) throw new PromoterError("PROMOTER_INVALID_COMMAND", "A legal name and operation ID are required.");
    const existing = await this.db.promoterAccount.findUnique({ where: { userId: input.userId } });
    if (existing) {
      if (existing.operationId && existing.operationId !== input.operationId) throw new PromoterError("PROMOTER_INVALID_COMMAND", "A promoter account already exists for this user.");
      return Object.freeze({ ...existing, replayed: true });
    }
    return this.db.promoterAccount.create({ data: { publicReference: reference(), userId: input.userId, legalName: input.legalName.trim(), displayName: input.displayName?.trim() || null, status: "APPLIED", operationId: input.operationId, requestHash: input.requestHash } });
  }
  async activate(input: Readonly<{ accountId: string; operationId: string }>) {
    assertPromotersProductionReady(); if (!operation.test(input.operationId)) throw new PromoterError("PROMOTER_INVALID_COMMAND", "A valid operation ID is required.");
    const account = await this.db.promoterAccount.findUnique({ where: { id: input.accountId } }); if (!account) throw new PromoterError("PROMOTER_NOT_ELIGIBLE", "Promoter account not found.");
    assertPromoterActivationEligibility(account);
    return this.db.promoterAccount.update({ where: { id: account.id }, data: { status: "ACTIVE", activatedAt: new Date() } });
  }
}
