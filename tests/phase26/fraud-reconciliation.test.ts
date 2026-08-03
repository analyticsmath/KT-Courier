/* eslint-disable @typescript-eslint/no-explicit-any -- focused fake repositories exercise DB-free fraud & reconciliation boundaries. */
import { beforeEach, describe, expect, it } from "vitest";
import { RecruitmentFraudService } from "@/lib/recruitment/fraud.service";
import { RecruitmentReconciliationService } from "@/lib/recruitment/reconciliation.service";

describe("Phase 26 Fraud and Reconciliation Invariants", () => {
  let db: any;
  let fraudService: RecruitmentFraudService;
  let reconciliationService: RecruitmentReconciliationService;

  beforeEach(() => {
    db = {
      recruitmentFraudCase: {
        create: async ({ data }: any) => ({ id: "fc-1", ...data }),
        findMany: async () => [{ id: "fc-1", outcome: "REVIEW" }],
      },
      recruitmentOpening: {
        findMany: async () => [],
      },
      recruitmentReconciliationCase: {
        create: async ({ data }: any) => ({ id: "rc-1", ...data }),
        findUnique: async ({ where }: any) => {
          if (where.publicReference === "REC-100") {
            return {
              id: "rc-1",
              publicReference: "REC-100",
              reasonCode: "HANDOFF_PROCESSING_FAILED",
              status: "OPEN",
              applicationId: "app-1",
              application: { status: "COMPLETED" }, // Canonical state has converged
            };
          }
          if (where.publicReference === "REC-NOT-CONVERGED") {
            return {
              id: "rc-1",
              publicReference: "REC-NOT-CONVERGED",
              reasonCode: "HANDOFF_PROCESSING_FAILED",
              status: "OPEN",
              applicationId: "app-1",
              application: { status: "DRAFT" }, // Canonical state has NOT converged
            };
          }
          return null;
        },
        update: async ({ data }: any) => data,
        findMany: async () => [{ id: "rc-1", status: "OPEN" }],
      },
    };

    fraudService = new RecruitmentFraudService(db);
    reconciliationService = new RecruitmentReconciliationService(db);
  });

  describe("Fraud Detection Invariants", () => {
    it("produces deterministic outcomes and never automatically rejects an applicant", async () => {
      const fraudCase = await fraudService.evaluateApplicationFraud({
        applicationId: "app-1",
        signals: [
          { signalType: "DUPLICATE_IDENTITY", severity: "HIGH" },
          { signalType: "CONFLICTING_LICENCE_DATA", severity: "MEDIUM" },
        ],
      });

      expect(["PASS", "REVIEW", "BLOCK_SUBMISSION", "BLOCK_DECISION", "BLOCK_OFFER", "BLOCK_HANDOFF"]).toContain(
        fraudCase.outcome
      );
      // Fraud case outcome must NOT set state to REJECTED automatically
      expect(fraudCase.outcome).not.toBe("REJECTED");
    });
  });

  describe("Reconciliation Recovery Invariants", () => {
    it("supports only allowed recovery actions and rejects arbitrary manual overrides", async () => {
      const allowedActions = [
        "rescan",
        "retry-opening-publication",
        "retry-application-freeze",
        "retry-check-composition",
        "retry-offer-issuance",
        "retry-onboarding-handoff",
        "retry-retention-action",
      ];

      for (const action of allowedActions) {
        const result = await reconciliationService.executeRecoveryAction("REC-100", action);
        expect(result.actionExecuted).toBe(action);
      }

      await expect(
        reconciliationService.executeRecoveryAction("REC-100", "MANUAL_EMPLOYEE_ACTIVATION")
      ).rejects.toThrow("Recovery action MANUAL_EMPLOYEE_ACTIVATION is not an authorized reconciliation recovery action.");
    });

    it("resolves reconciliation case only after canonical state convergence", async () => {
      const resolved = await reconciliationService.resolveCaseAfterConvergence("REC-100");
      expect(resolved.status).toBe("RESOLVED");

      await expect(
        reconciliationService.resolveCaseAfterConvergence("REC-NOT-CONVERGED")
      ).rejects.toThrow("Cannot resolve reconciliation case before canonical convergence.");
    });
  });
});
