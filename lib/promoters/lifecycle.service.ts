/* eslint-disable @typescript-eslint/no-explicit-any -- generated Prisma delegates are intentionally deferred. */
import { createHash, randomUUID } from "node:crypto";
import { assertInternalDestination, assertPromoterActivationEligibility, assertPromoterTargetAvailable } from "./policy";
import { PromoterError } from "./errors";
import { assertPromotersProductionReady } from "./production-readiness";
import { fingerprintPromoterCode, hmacPromoterCode, maskPromoterCode, normalizePromoterCode, signPromoterReferralToken } from "./code-security";

type Db = any;
type Command = Record<string, any>;
const ref = (prefix: string) => `${prefix}-${randomUUID().replaceAll("-", "").toUpperCase()}`;
const operationId = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,119}$/;
const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const gate = () => assertPromotersProductionReady();
const event = (tx: Db, eventType: string, aggregateReference: string, operationId: string) => tx.promoterEventIntent.create({ data: { eventType, aggregateReference, operationId, safePayload: { phase: 25 } } });
function validOperation(input: Command) { if (!operationId.test(input.operationId ?? "")) throw new PromoterError("PROMOTER_INVALID_COMMAND", "A stable operation ID is required."); }
const accountTransitions: Record<string, readonly string[]> = {
  APPLIED: ["APPROVED", "CHANGES_REQUIRED", "TERMINATED"],
  CHANGES_REQUIRED: ["APPROVED", "TERMINATED"],
  APPROVED: ["ACTIVE", "TERMINATED"],
  ACTIVE: ["SUSPENDED", "TERMINATED"],
  SUSPENDED: ["TERMINATED"],
  TERMINATED: [],
};
const programTransitions: Record<string, readonly string[]> = {
  DRAFT: ["UNDER_REVIEW"],
  UNDER_REVIEW: ["APPROVED", "REJECTED"],
  APPROVED: ["ACTIVE"],
  ACTIVE: ["PAUSED", "ENDED"],
  PAUSED: ["ACTIVE", "ENDED"],
  ENDED: [],
  RETIRED: [],
  REJECTED: [],
};
function assertAccountTransition(account: Command, nextStatus: string, allowedStatuses: readonly string[]) {
  if (!account || !allowedStatuses.includes(account.status) || !accountTransitions[account.status]?.includes(nextStatus)) throw new PromoterError("PROMOTER_INVALID_COMMAND", "Promoter account lifecycle transition is not allowed.");
}

/** Canonical Phase 25 lifecycle. Every mutation is durable, replay-aware and gated. */
export class PromoterLifecycleService {
  constructor(private readonly db: Db) {}

  async submitPromoterApplication(input: Command) {
    gate(); validOperation(input); const requestHash = input.requestHash ?? hash(input);
    return this.db.$transaction(async (tx: Db) => {
      const existing = await tx.promoterAccount.findUnique({ where: { userId: input.userId } });
      if (existing) { if (existing.operationId === input.operationId && existing.requestHash === requestHash) return existing; throw new PromoterError("PROMOTER_INVALID_COMMAND", "A promoter application already exists."); }
      const account = await tx.promoterAccount.create({ data: { publicReference: ref("PRA"), userId: input.userId, legalName: input.legalName.trim(), displayName: input.displayName?.trim() || null, status: "APPLIED", operationId: input.operationId, requestHash } });
      await event(tx, "PROMOTER_APPLICATION_SUBMITTED", account.publicReference, `event:${input.operationId}`); return account;
    });
  }
  async reviewPromoterApplication(input: Command) { gate(); validOperation(input); return this.changeAccount(input, input.approved ? "APPROVED" : "CHANGES_REQUIRED", input.approved ? "PROMOTER_APPROVED" : "PROMOTER_CHANGES_REQUIRED", { approvedAt: input.approved ? new Date() : null }, ["APPLIED", "CHANGES_REQUIRED"]); }
  async acceptPromoterAgreement(input: Command) {
    gate(); validOperation(input); return this.db.$transaction(async (tx: Db) => {
      const version = await tx.promoterAgreementVersion.findFirst({ where: { id: input.agreementVersionId, status: "ACTIVE", effectiveFrom: { lte: new Date() }, OR: [{ effectiveUntil: null }, { effectiveUntil: { gt: new Date() } }] } });
      if (!version) throw new PromoterError("PROMOTER_AGREEMENT_REQUIRED", "The current promoter agreement must be accepted.");
      const account = await tx.promoterAccount.findUnique({ where: { id: input.promoterAccountId } }); if (!account) throw new PromoterError("PROMOTER_FORBIDDEN", "Promoter account not found.");
      const previous = await tx.promoterAgreementAcceptance.findUnique({ where: { operationId: input.operationId } });
      if (previous) { if (previous.requestHash !== (input.requestHash ?? hash(input))) throw new PromoterError("PROMOTER_INVALID_COMMAND", "Operation conflict."); return previous; }
      const acceptance = await tx.promoterAgreementAcceptance.create({ data: { promoterAccountId: account.id, agreementVersionId: version.id, acceptanceEvidence: { acceptedAt: new Date().toISOString(), source: "PROMOTER" }, operationId: input.operationId, requestHash: input.requestHash ?? hash(input) } });
      await tx.promoterAccount.update({ where: { id: account.id }, data: { agreementStatus: "ACCEPTED" } }); return acceptance;
    });
  }
  async activatePromoterAccount(input: Command) {
    gate(); validOperation(input);
    return this.db.$transaction(async (tx: Db) => {
      const account = await tx.promoterAccount.findUnique({ where: { id: input.promoterAccountId }, include: { fraudCases: { where: { status: { in: ["OPEN", "UNDER_REVIEW", "ACTION_REQUIRED", "CONFIRMED"] } } } } });
      if (!account || account.fraudCases.length) throw new PromoterError("PROMOTER_NOT_ELIGIBLE", "Promoter account has unresolved eligibility review.");
      assertPromoterActivationEligibility(account);
      const result = await tx.promoterAccount.update({ where: { id: account.id }, data: { status: "ACTIVE", activatedAt: new Date() } });
      await event(tx, "PROMOTER_ACTIVATED", result.publicReference, input.operationId);
      return result;
    });
  }
  async requestPromoterAccountChanges(input: Command) { return this.changeAccount(input, "CHANGES_REQUIRED", "PROMOTER_CHANGES_REQUIRED", { approvedAt: null }, ["APPLIED", "CHANGES_REQUIRED"]); }
  async suspendPromoterAccount(input: Command) { return this.changeAccount(input, "SUSPENDED", "PROMOTER_SUSPENDED", { suspendedAt: new Date() }, ["ACTIVE"]); }
  async terminatePromoterAccount(input: Command) { return this.changeAccount(input, "TERMINATED", "PROMOTER_TERMINATED", { terminatedAt: new Date() }, ["APPLIED", "CHANGES_REQUIRED", "APPROVED", "ACTIVE", "SUSPENDED"]); }
  private async changeAccount(input: Command, status: string, eventType: string, data: Command, allowedStatuses: readonly string[]) { gate(); validOperation(input); return this.db.$transaction(async (tx: Db) => { const current = await tx.promoterAccount.findUnique({ where: { id: input.promoterAccountId } }); assertAccountTransition(current, status, allowedStatuses); const account = await tx.promoterAccount.update({ where: { id: input.promoterAccountId }, data: { ...data, status } }); await event(tx, eventType, account.publicReference, input.operationId); return account; }); }

  async createPromoterProgramDraft(input: Command) {
    gate(); validOperation(input); assertPromoterTargetAvailable(input.targetType);
    return this.db.$transaction(async (tx: Db) => {
      const replay = await tx.promoterEventIntent.findUnique({ where: { operationId: `program:${input.operationId}` } });
      if (replay) return tx.promoterProgram.findUnique({ where: { publicReference: replay.aggregateReference } });
      const program = await tx.promoterProgram.create({ data: { publicReference: ref("PPG"), code: input.code.trim().toUpperCase(), name: input.name.trim(), targetType: input.targetType, status: "DRAFT" } });
      const version = await tx.promoterProgramVersion.create({ data: { publicReference: ref("PPV"), programId: program.id, versionNumber: 1, status: "DRAFT", ...input.versionTerms } });
      await event(tx, "PROMOTER_PROGRAM_ENROLLED", program.publicReference, `program:${input.operationId}`);
      return { ...program, version };
    });
  }
  async submitPromoterProgram(input: Command) { return this.changeProgram(input, "UNDER_REVIEW", "DRAFT"); }
  async approvePromoterProgram(input: Command) { gate(); validOperation(input); if (input.createdByUserId === input.approvedByUserId) throw new PromoterError("PROMOTER_FORBIDDEN", "Program creators may not self-approve."); return this.db.$transaction(async (tx: Db) => { const existing = await tx.promoterProgram.findUnique({ where: { id: input.programId } }); const version = await tx.promoterProgramVersion.findUnique({ where: { id: input.programVersionId } }); if (!existing || !version || version.programId !== existing.id || existing.status !== "UNDER_REVIEW" || version.status !== "DRAFT") throw new PromoterError("PROMOTER_NOT_ELIGIBLE", "Only a submitted program draft may be approved."); assertPromoterTargetAvailable(existing.targetType); const program = await tx.promoterProgram.update({ where: { id: input.programId }, data: { status: "APPROVED" } }); const approvedVersion = await tx.promoterProgramVersion.update({ where: { id: input.programVersionId }, data: { status: "APPROVED", approvedAt: new Date(), approvedByUserId: input.approvedByUserId } }); await event(tx, "PROMOTER_PROGRAM_ENROLLED", approvedVersion.publicReference, input.operationId); return program; }); }
  async activatePromoterProgram(input: Command) { gate(); const program = await this.db.promoterProgram.findUnique({ where: { id: input.programId } }); if (!program) throw new PromoterError("PROMOTER_NOT_ELIGIBLE", "Program not found."); assertPromoterTargetAvailable(program.targetType); return this.changeProgram(input, "ACTIVE", "APPROVED", "ACTIVE"); }
  async pausePromoterProgram(input: Command) { return this.changeProgram(input, "PAUSED", "ACTIVE", "PAUSED"); }
  async endPromoterProgram(input: Command) { return this.changeProgram(input, "ENDED", ["ACTIVE", "PAUSED"], "ENDED"); }
  async rejectPromoterProgram(input: Command) { return this.changeProgram(input, "REJECTED", "UNDER_REVIEW", "REJECTED"); }
  /** Commercial terms are draft-only. Approved versions are never edited in place. */
  async updatePromoterProgramDraft(input: Command) {
    gate(); validOperation(input); assertPromoterTargetAvailable(input.targetType);
    return this.db.$transaction(async (tx: Db) => {
      const program = await tx.promoterProgram.findUnique({ where: { id: input.programId } });
      const version = await tx.promoterProgramVersion.findUnique({ where: { id: input.programVersionId } });
      if (!program || !version || version.programId !== program.id || program.status !== "DRAFT" || version.status !== "DRAFT") throw new PromoterError("PROMOTER_NOT_ELIGIBLE", "Only draft commercial terms may be changed.");
      await tx.promoterProgram.update({ where: { id: program.id }, data: { code: input.code.trim().toUpperCase(), name: input.name.trim(), targetType: input.targetType } });
      return tx.promoterProgramVersion.update({ where: { id: version.id }, data: input.versionTerms });
    });
  }
  private async changeProgram(input: Command, status: string, expected?: string | readonly string[], versionStatus?: string) { gate(); validOperation(input); return this.db.$transaction(async (tx: Db) => { const program = await tx.promoterProgram.findUnique({ where: { id: input.programId } }); const allowedFrom = expected ? (Array.isArray(expected) ? expected : [expected]) : undefined; if (!program || (allowedFrom && !allowedFrom.includes(program.status)) || !programTransitions[program.status]?.includes(status)) throw new PromoterError("PROMOTER_NOT_ELIGIBLE", "Program transition is not allowed."); if (input.programVersionId && versionStatus) { const version = await tx.promoterProgramVersion.findUnique({ where: { id: input.programVersionId } }); if (!version || version.programId !== program.id || !["DRAFT", "APPROVED", "ACTIVE", "PAUSED"].includes(version.status)) throw new PromoterError("PROMOTER_NOT_ELIGIBLE", "Program version does not belong to the transition."); await tx.promoterProgramVersion.update({ where: { id: input.programVersionId }, data: { status: versionStatus, ...(status === "ACTIVE" ? { activatedAt: new Date() } : {}), ...(status === "PAUSED" ? { pausedAt: new Date() } : {}), ...(status === "ENDED" ? { endedAt: new Date() } : {}) } }); } return tx.promoterProgram.update({ where: { id: input.programId }, data: { status } }); }); }
  async enrollPromoterInProgram(input: Command) { gate(); validOperation(input); return this.db.$transaction(async (tx: Db) => { const account = await tx.promoterAccount.findUnique({ where: { id: input.promoterAccountId } }); const version = await tx.promoterProgramVersion.findUnique({ where: { id: input.programVersionId } }); if (!account || account.status !== "ACTIVE" || !version || version.status !== "ACTIVE") throw new PromoterError("PROMOTER_NOT_ELIGIBLE", "Active account and program version are required."); const found = await tx.promoterEnrollment.findUnique({ where: { promoterAccountId_programVersionId: { promoterAccountId: account.id, programVersionId: version.id } } }); if (found) throw new PromoterError("PROMOTER_INVALID_COMMAND", "Duplicate active enrolment is not allowed."); const enrollment = await tx.promoterEnrollment.create({ data: { publicReference: ref("PEN"), promoterAccountId: account.id, programVersionId: version.id, status: "ACTIVE", operationId: input.operationId, requestHash: input.requestHash ?? hash(input) } }); await event(tx, "PROMOTER_PROGRAM_ENROLLED", enrollment.publicReference, `event:${input.operationId}`); return enrollment; }); }
  async suspendPromoterEnrollment(input: Command) { return this.changeEnrollment(input, "SUSPENDED"); }
  async endPromoterEnrollment(input: Command) { return this.changeEnrollment(input, "ENDED"); }
  private async changeEnrollment(input: Command, status: string) { gate(); validOperation(input); return this.db.$transaction(async (tx: Db) => { const enrollment = await tx.promoterEnrollment.findUnique({ where: { id: input.enrollmentId } }); const allowed = status === "SUSPENDED" ? ["ACTIVE"] : ["ACTIVE", "SUSPENDED"]; if (!enrollment || !allowed.includes(enrollment.status)) throw new PromoterError("PROMOTER_INVALID_COMMAND", "Enrolment lifecycle transition is not allowed."); return tx.promoterEnrollment.update({ where: { id: input.enrollmentId }, data: { status, ...(status === "SUSPENDED" ? { suspendedAt: new Date() } : { endedAt: new Date() }) } }); }); }

  async createPromoterChannel(input: Command) {
    gate(); validOperation(input);
    if (!new Set(["PERSONAL_LINK", "SOCIAL_MEDIA", "OFFLINE", "PARTNER_CHANNEL"]).has(input.channelType) || typeof input.name !== "string" || input.name.trim().length < 2 || input.name.trim().length > 120) throw new PromoterError("PROMOTER_INVALID_COMMAND", "A valid owned promoter channel is required.");
    const enrollment = await this.db.promoterEnrollment.findFirst({ where: { id: input.enrollmentId, promoterAccountId: input.promoterAccountId, status: "ACTIVE", promoterAccount: { status: "ACTIVE" } } });
    if (!enrollment) throw new PromoterError("PROMOTER_NOT_ELIGIBLE", "An active owned enrolment is required.");
    return this.db.promoterChannel.create({ data: { publicReference: ref("PCH"), promoterAccountId: input.promoterAccountId, enrollmentId: enrollment.id, name: input.name.trim(), channelType: input.channelType, status: "ACTIVE" } });
  }

  async updatePromoterProfile(input: Command) {
    gate(); validOperation(input);
    const displayName = typeof input.displayName === "string" ? input.displayName.trim() : undefined;
    if (displayName !== undefined && (displayName.length < 2 || displayName.length > 120)) throw new PromoterError("PROMOTER_INVALID_COMMAND", "Profile display name is invalid.");
    return this.db.promoterAccount.update({ where: { id: input.promoterAccountId }, data: { ...(displayName !== undefined ? { displayName } : {}) } });
  }

  async updatePromoterCompliance(input: Command) {
    gate(); validOperation(input);
    const identityStatus = input.identityStatus; const taxProfileStatus = input.taxProfileStatus; const payoutReadinessStatus = input.payoutReadinessStatus;
    if (!["PENDING", "VERIFIED"].includes(identityStatus) || !["PENDING", "READY"].includes(taxProfileStatus) || !["PENDING", "READY"].includes(payoutReadinessStatus)) throw new PromoterError("PROMOTER_INVALID_COMMAND", "Compliance readiness values are invalid.");
    return this.db.promoterAccount.update({ where: { id: input.promoterAccountId }, data: { identityStatus, taxProfileStatus, payoutReadinessStatus } });
  }

  async createPromoterReferralCode(input: Command) { gate(); validOperation(input); const code = normalizePromoterCode(input.code); return this.db.$transaction(async (tx: Db) => { const eligible = await tx.promoterEnrollment.findFirst({ where: { id: input.enrollmentId, promoterAccountId: input.promoterAccountId, status: "ACTIVE", promoterAccount: { status: "ACTIVE" } } }); if (!eligible) throw new PromoterError("PROMOTER_NOT_ELIGIBLE", "An active promoter enrolment is required."); return tx.promoterReferralCode.create({ data: { publicReference: ref("PRC"), promoterAccountId: input.promoterAccountId, enrollmentId: input.enrollmentId, channelId: input.channelId ?? null, codeHmac: hmacPromoterCode(code), codeFingerprint: fingerprintPromoterCode(code), maskedDisplay: maskPromoterCode(code), status: "ACTIVE", startsAt: new Date(), expiresAt: input.expiresAt ?? null } }); }); }
  async archivePromoterReferralCode(input: Command) { gate(); validOperation(input); const code = await this.db.promoterReferralCode.findFirst({ where: { id: input.referralCodeId, ...(input.promoterAccountId ? { promoterAccountId: input.promoterAccountId } : {}), status: "ACTIVE" } }); if (!code) throw new PromoterError("PROMOTER_FORBIDDEN", "Only an active owned referral code may be archived."); return this.db.promoterReferralCode.update({ where: { id: code.id }, data: { status: "ARCHIVED", archivedAt: new Date() } }); }
  async resolvePromoterReferralCode(input: Command) { gate(); const code = await this.db.promoterReferralCode.findFirst({ where: { codeHmac: hmacPromoterCode(input.code), status: "ACTIVE", OR: [{ startsAt: null }, { startsAt: { lte: new Date() } }], AND: [{ OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] }] }, include: { enrollment: { include: { programVersion: true } }, promoterAccount: true } }); if (!code || code.enrollment.status !== "ACTIVE" || code.enrollment.programVersion.status !== "ACTIVE" || code.promoterAccount.status !== "ACTIVE") throw new PromoterError("PROMOTER_NOT_ELIGIBLE", "Referral code is unavailable."); return Object.freeze({ referralCodeId: code.id, enrollmentId: code.enrollmentId, enrollmentReference: code.enrollment.publicReference, programVersionId: code.enrollment.programVersionId, programVersionReference: code.enrollment.programVersion.publicReference, promoterAccountId: code.promoterAccountId, maskedDisplay: code.maskedDisplay }); }
  async recordPromoterTouch(input: Command) { gate(); validOperation(input); const requestHash = input.requestHash ?? hash(input); const replay = await this.db.promoterTouch.findUnique({ where: { operationId: input.operationId } }); if (replay) { if (replay.requestHash !== requestHash) throw new PromoterError("PROMOTER_INVALID_COMMAND", "Touch operation was already used with a different request."); return replay; } assertInternalDestination(input.destinationType, input.destinationReference); const code = await this.resolvePromoterReferralCode(input); if (code.programVersionId !== input.programVersionId) throw new PromoterError("PROMOTER_INVALID_COMMAND", "Referral code and program version do not match."); return this.db.promoterTouch.create({ data: { publicReference: ref("PTC"), promoterAccountId: code.promoterAccountId, enrollmentId: code.enrollmentId, programVersionId: input.programVersionId, referralCodeId: code.referralCodeId, touchType: input.touchType ?? "LINK_VISIT", validityStatus: "VALID", sessionFingerprint: input.sessionFingerprint ?? null, networkRiskFingerprint: input.networkRiskFingerprint ?? null, destinationType: input.destinationType, destinationReference: input.destinationReference ?? null, occurredAt: new Date(), operationId: input.operationId, requestHash, safeEvidence: { code: code.maskedDisplay } } }); }
  async createSignedReferralToken(input: Command) { gate(); assertInternalDestination(input.destinationType, input.destinationReference); return signPromoterReferralToken({ touchReference: input.touchReference, programVersionReference: input.programVersionReference, enrollmentReference: input.enrollmentReference, destinationType: input.destinationType }, input.ttlSeconds ?? 900); }
}

export const submitPromoterApplication = (service: PromoterLifecycleService, input: Command) => service.submitPromoterApplication(input);
export const reviewPromoterApplication = (service: PromoterLifecycleService, input: Command) => service.reviewPromoterApplication(input);
export const acceptPromoterAgreement = (service: PromoterLifecycleService, input: Command) => service.acceptPromoterAgreement(input);
export const activatePromoterAccount = (service: PromoterLifecycleService, input: Command) => service.activatePromoterAccount(input);
export const suspendPromoterAccount = (service: PromoterLifecycleService, input: Command) => service.suspendPromoterAccount(input);
export const terminatePromoterAccount = (service: PromoterLifecycleService, input: Command) => service.terminatePromoterAccount(input);
