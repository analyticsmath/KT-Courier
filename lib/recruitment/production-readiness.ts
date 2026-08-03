/**
 * Phase 26 — Recruitment Production Readiness Gate
 *
 * Direct production mutations (publishing job openings, submitting applications,
 * issuing screening decisions, issuing offers, executing onboarding handoffs,
 * and retention deletions) are strictly DEFERRED to Phase 26.5:
 * Consolidated Validation and Stabilization.
 */

export const RECRUITMENT_PRODUCTION_VALIDATION_APPROVED = false;

export const RECRUITMENT_PRODUCTION_BLOCK_REASON =
  "CONSOLIDATED_VALIDATION_NOT_APPROVED";

export class RecruitmentProductionLockError extends Error {
  readonly code = RECRUITMENT_PRODUCTION_BLOCK_REASON;
  constructor(message = "Recruitment production validation is not approved. Deferred to Phase 26.5.") {
    super(message);
    this.name = "RecruitmentProductionLockError";
  }
}

export function assertRecruitmentProductionReady(): void {
  if (!RECRUITMENT_PRODUCTION_VALIDATION_APPROVED) {
    throw new RecruitmentProductionLockError();
  }
}
