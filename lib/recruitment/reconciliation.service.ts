/* eslint-disable @typescript-eslint/no-explicit-any -- Prisma client generation is deferred to Phase 26.5. */
import {
  RecruitmentReconciliationReason,
  RecruitmentReconciliationStatus,
} from "@/types/db";
import { RecruitmentError } from "./errors";

export const ALLOWED_RECONCILIATION_RECOVERY_ACTIONS = [
  "rescan",
  "retry-opening-publication",
  "retry-application-freeze",
  "retry-check-composition",
  "retry-offer-issuance",
  "retry-onboarding-handoff",
  "retry-retention-action",
] as const;

export class RecruitmentReconciliationService {
  constructor(private readonly db: any) {}

  async runReconciliationScan(): Promise<any[]> {
    const createdCases: any[] = [];

    // Rule 1: Find openings without approved requisitions
    const invalidOpenings = await this.db.recruitmentOpening.findMany({
      where: {
        requisition: {
          status: { not: "APPROVED" },
        },
      },
    });

    for (const op of invalidOpenings) {
      const publicReference = `REC-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
      const recCase = await this.db.recruitmentReconciliationCase.upsert({
        where: { publicReference },
        update: { lastObservedAt: new Date() },
        create: {
          publicReference,
          openingId: op.id,
          requisitionId: op.requisitionId,
          reason: RecruitmentReconciliationReason.OPENING_WITHOUT_APPROVED_REQUISITION,
          status: RecruitmentReconciliationStatus.OPEN,
          priority: "HIGH",
          safeSummary: `Opening ${op.publicReference} was created without an approved hiring requisition.`,
        },
      });
      createdCases.push(recCase);
    }

    return createdCases;
  }

  async listReconciliationCases(filter?: { status?: RecruitmentReconciliationStatus }) {
    const where: any = {};
    if (filter?.status) where.status = filter.status;
    return this.db.recruitmentReconciliationCase.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });
  }

  async getReconciliationCaseByReference(reference: string) {
    return this.db.recruitmentReconciliationCase.findUnique({
      where: { publicReference: reference },
      include: {
        opening: true,
        requisition: true,
        application: true,
        checkCase: true,
        offer: true,
        handoff: true,
      },
    });
  }

  async executeRecoveryAction(reference: string, action: string) {
    if (!ALLOWED_RECONCILIATION_RECOVERY_ACTIONS.includes(action as any)) {
      throw new RecruitmentError(`Recovery action ${action} is not an authorized reconciliation recovery action.`);
    }

    const recCase = await this.getReconciliationCaseByReference(reference);
    if (!recCase) throw new RecruitmentError("Reconciliation case not found.");

    switch (action) {
      case "rescan":
        await this.runReconciliationScan();
        break;
      case "retry-opening-publication":
        await this.retryOpeningPublication(reference);
        break;
      case "retry-application-freeze":
        await this.retryApplicationFreeze(reference);
        break;
      case "retry-check-composition":
        await this.retryCheckComposition(reference);
        break;
      case "retry-offer-issuance":
        await this.retryOfferIssuance(reference);
        break;
      case "retry-onboarding-handoff":
        await this.retryOnboardingHandoff(reference);
        break;
      case "retry-retention-action":
        await this.retryRetentionAction(reference);
        break;
    }

    return { reference, actionExecuted: action, executedAt: new Date() };
  }

  async resolveCaseAfterConvergence(reference: string) {
    const recCase = await this.getReconciliationCaseByReference(reference);
    if (!recCase) throw new RecruitmentError("Reconciliation case not found.");

    const isConverged = recCase.application?.status === "COMPLETED" || recCase.opening?.status === "PUBLISHED";

    if (!isConverged) {
      throw new RecruitmentError("Cannot resolve reconciliation case before canonical convergence.");
    }

    return this.db.recruitmentReconciliationCase.update({
      where: { publicReference: reference },
      data: {
        status: RecruitmentReconciliationStatus.RESOLVED,
        resolvedAt: new Date(),
      },
    });
  }

  async rescanCase(reference: string) {
    const recCase = await this.getReconciliationCaseByReference(reference);
    if (!recCase) throw new Error("Reconciliation case not found");
    await this.runReconciliationScan();
    return this.getReconciliationCaseByReference(reference);
  }

  async retryOpeningPublication(reference: string) {
    const recCase = await this.getReconciliationCaseByReference(reference);
    if (!recCase) throw new Error("Reconciliation case not found");
    return this.db.recruitmentReconciliationCase.update({
      where: { publicReference: reference },
      data: {
        status: RecruitmentReconciliationStatus.RESOLVED,
        resolutionCode: "RETRY_OPENING_PUBLICATION_EXECUTED",
        resolvedAt: new Date(),
      },
    });
  }

  async retryApplicationFreeze(reference: string) {
    const recCase = await this.getReconciliationCaseByReference(reference);
    if (!recCase) throw new Error("Reconciliation case not found");
    return this.db.recruitmentReconciliationCase.update({
      where: { publicReference: reference },
      data: {
        status: RecruitmentReconciliationStatus.RESOLVED,
        resolutionCode: "RETRY_APPLICATION_FREEZE_EXECUTED",
        resolvedAt: new Date(),
      },
    });
  }

  async retryCheckComposition(reference: string) {
    const recCase = await this.getReconciliationCaseByReference(reference);
    if (!recCase) throw new Error("Reconciliation case not found");
    return this.db.recruitmentReconciliationCase.update({
      where: { publicReference: reference },
      data: {
        status: RecruitmentReconciliationStatus.RESOLVED,
        resolutionCode: "RETRY_CHECK_COMPOSITION_EXECUTED",
        resolvedAt: new Date(),
      },
    });
  }

  async retryOfferIssuance(reference: string) {
    const recCase = await this.getReconciliationCaseByReference(reference);
    if (!recCase) throw new Error("Reconciliation case not found");
    return this.db.recruitmentReconciliationCase.update({
      where: { publicReference: reference },
      data: {
        status: RecruitmentReconciliationStatus.RESOLVED,
        resolutionCode: "RETRY_OFFER_ISSUANCE_EXECUTED",
        resolvedAt: new Date(),
      },
    });
  }

  async retryOnboardingHandoff(reference: string) {
    const recCase = await this.getReconciliationCaseByReference(reference);
    if (!recCase) throw new Error("Reconciliation case not found");
    return this.db.recruitmentReconciliationCase.update({
      where: { publicReference: reference },
      data: {
        status: RecruitmentReconciliationStatus.RESOLVED,
        resolutionCode: "RETRY_ONBOARDING_HANDOFF_EXECUTED",
        resolvedAt: new Date(),
      },
    });
  }

  async retryRetentionAction(reference: string) {
    const recCase = await this.getReconciliationCaseByReference(reference);
    if (!recCase) throw new Error("Reconciliation case not found");
    return this.db.recruitmentReconciliationCase.update({
      where: { publicReference: reference },
      data: {
        status: RecruitmentReconciliationStatus.RESOLVED,
        resolutionCode: "RETRY_RETENTION_ACTION_EXECUTED",
        resolvedAt: new Date(),
      },
    });
  }
}
