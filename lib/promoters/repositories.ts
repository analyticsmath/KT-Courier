/* eslint-disable @typescript-eslint/no-explicit-any -- Phase 25 remains source-locked until Prisma client generation in Phase 26.5. */
import { prisma } from "@/lib/db/prisma";
import { PromoterError } from "./errors";

type Db = any;
type Row = Record<string, any>;

export class PromoterRepositoryError extends PromoterError {
  constructor(code: "PROMOTER_INVALID_COMMAND" | "PROMOTER_FORBIDDEN", message: string) { super(code, message); }
}

function safe(row: Row | null) {
  if (!row) return null;
  const projection = { ...row };
  for (const field of ["codeHmac", "codeFingerprint", "legalName", "complianceEvidence", "safeEvidence"]) delete projection[field];
  return Object.freeze(projection);
}

function repository(delegateName: string, database: Db = prisma) {
  const delegate = () => database[delegateName];
  return Object.freeze({
    async findByPublicReference(publicReference: string) { return safe(await delegate().findUnique({ where: { publicReference } })); },
    async findRawByPublicReference(publicReference: string) { return delegate().findUnique({ where: { publicReference } }); },
    async findByOperation(operationId: string) { return delegate().findUnique({ where: { operationId } }); },
    async assertReplay(operationId: string, requestHash: string) {
      const existing = await delegate().findUnique({ where: { operationId } });
      if (existing && existing.requestHash !== requestHash) throw new PromoterRepositoryError("PROMOTER_INVALID_COMMAND", "Operation ID was already used with a different request.");
      return existing;
    },
    async create(data: Row) {
      const replay = data.operationId ? await this.assertReplay(data.operationId, data.requestHash) : null;
      return replay ?? delegate().create({ data });
    },
    async updateWithVersion(id: string, version: number | undefined, data: Row) {
      if (version === undefined) return delegate().update({ where: { id }, data });
      const updated = await delegate().updateMany({ where: { id, version }, data: { ...data, version: { increment: 1 } } });
      if (updated.count !== 1) throw new PromoterRepositoryError("PROMOTER_INVALID_COMMAND", "The record was changed by another operation.");
      return delegate().findUnique({ where: { id } });
    },
  });
}

export const createPrismaPromoterAccountRepository = (db?: Db) => Object.freeze({
  ...repository("promoterAccount", db),
  async verifyOwnership(publicReference: string, userId: string) { return Boolean(await (db ?? prisma).promoterAccount.findFirst({ where: { publicReference, userId }, select: { id: true } })); },
});
export const createPrismaPromoterAgreementVersionRepository = (db?: Db) => Object.freeze({ ...repository("promoterAgreementVersion", db), async findCurrentApproved() { return (db ?? prisma).promoterAgreementVersion.findFirst({ where: { status: "ACTIVE" }, orderBy: { versionNumber: "desc" } }); } });
export const createPrismaPromoterAgreementAcceptanceRepository = (db?: Db) => repository("promoterAgreementAcceptance", db);
export const createPrismaPromoterProgramRepository = (db?: Db) => repository("promoterProgram", db);
export const createPrismaPromoterProgramVersionRepository = (db?: Db) => Object.freeze({ ...repository("promoterProgramVersion", db), async findImmutableApproved(publicReference: string) { return (db ?? prisma).promoterProgramVersion.findFirst({ where: { publicReference, status: { in: ["APPROVED", "ACTIVE", "PAUSED", "ENDED"] } } }); } });
export const createPrismaPromoterEnrollmentRepository = (db?: Db) => repository("promoterEnrollment", db);
export const createPrismaPromoterChannelRepository = (db?: Db) => repository("promoterChannel", db);
export const createPrismaPromoterReferralCodeRepository = (db?: Db) => Object.freeze({ ...repository("promoterReferralCode", db), async findActiveByHmac(codeHmac: string) { return (db ?? prisma).promoterReferralCode.findFirst({ where: { codeHmac, status: "ACTIVE" } }); } });
export const createPrismaPromoterTouchRepository = (db?: Db) => repository("promoterTouch", db);
export const createPrismaPromoterAttributionRepository = (db?: Db) => repository("promoterAttribution", db);
export const createPrismaPromoterQualificationRepository = (db?: Db) => repository("promoterQualification", db);
export const createPrismaPromoterEarningRepository = (db?: Db) => repository("promoterEarning", db);
export const createPrismaPromoterFraudCaseRepository = (db?: Db) => repository("promoterFraudCase", db);
export const createPrismaPromoterReconciliationCaseRepository = (db?: Db) => repository("promoterReconciliationCase", db);
export const createPrismaPromoterMarketingAssetRepository = (db?: Db) => repository("promoterMarketingAsset", db);
export const createPrismaPromoterDisputeRepository = (db?: Db) => repository("promoterDispute", db);
export const createPrismaPromoterEventIntentRepository = (db?: Db) => repository("promoterEventIntent", db);
/** Operation receipts use durable Phase 25 event intents; no memory/callback receipt exists. */
export const createPrismaPromoterOperationRepository = (db?: Db) => Object.freeze({
  async complete(operationId: string, aggregateReference: string, safePayload: Row) { return (db ?? prisma).promoterEventIntent.upsert({ where: { operationId }, create: { eventType: "PROMOTER_RECONCILIATION_REQUIRED", aggregateReference, operationId, safePayload }, update: {} }); },
  async find(operationId: string) { return (db ?? prisma).promoterEventIntent.findUnique({ where: { operationId } }); },
});

export function createPrismaPromoterRepositories(db: Db = prisma) {
  return Object.freeze({ account: createPrismaPromoterAccountRepository(db), agreementVersion: createPrismaPromoterAgreementVersionRepository(db), agreementAcceptance: createPrismaPromoterAgreementAcceptanceRepository(db), program: createPrismaPromoterProgramRepository(db), programVersion: createPrismaPromoterProgramVersionRepository(db), enrollment: createPrismaPromoterEnrollmentRepository(db), channel: createPrismaPromoterChannelRepository(db), referralCode: createPrismaPromoterReferralCodeRepository(db), touch: createPrismaPromoterTouchRepository(db), attribution: createPrismaPromoterAttributionRepository(db), qualification: createPrismaPromoterQualificationRepository(db), earning: createPrismaPromoterEarningRepository(db), fraudCase: createPrismaPromoterFraudCaseRepository(db), reconciliationCase: createPrismaPromoterReconciliationCaseRepository(db), marketingAsset: createPrismaPromoterMarketingAssetRepository(db), dispute: createPrismaPromoterDisputeRepository(db), eventIntent: createPrismaPromoterEventIntentRepository(db), operation: createPrismaPromoterOperationRepository(db) });
}
