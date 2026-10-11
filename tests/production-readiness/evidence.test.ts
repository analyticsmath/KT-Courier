import { describe, expect, it } from "vitest";
import { AcceptanceEvidenceSchema, evidenceIsCurrent, type AcceptanceRecord } from "@/lib/production-readiness/evidence";
const now = new Date("2026-10-07T00:00:00Z");
const releaseSha = "a".repeat(40);
const evidence = { kind: "CI" as const, key: "current_ci_certification" as const, releaseSha, observedAt: "2026-10-06T23:00:00Z", expiresAt: "2026-10-07T01:00:00Z", evidenceReference: "disposable:successful-ci", reason: "Disposable certification evidence", runUrl: "https://github.com/analyticsmath/KT-Courier/actions/runs/1", conclusion: "SUCCESS" as const, skippedCriticalTests: 0 as const, testsPassed: 10 };
const approved: AcceptanceRecord = { evidence, version: 2, status: "APPROVED", authorId: "author", approverId: "reviewer", approvedAt: "2026-10-06T23:30:00Z" };
describe("release evidence cannot substitute fixtures, stale releases or self-review for genuine acceptance", () => {
  it("requires successful repo-bound CI with zero critical skips", () => {
    expect(AcceptanceEvidenceSchema.safeParse(evidence).success).toBe(true);
    for (const patch of [{ conclusion: "FAILURE" }, { skippedCriticalTests: 1 }, { testsPassed: 0 }, { runUrl: "https://example.com/green" }]) expect(AcceptanceEvidenceSchema.safeParse({ ...evidence, ...patch }).success).toBe(false);
  });
  it("rejects absent, draft, revoked, self-reviewed, expired and different-SHA evidence", () => {
    expect(evidenceIsCurrent(approved, releaseSha, now)).toBe(true);
    expect(evidenceIsCurrent(undefined, releaseSha, now)).toBe(false);
    for (const patch of [{ status: "DRAFT" as const }, { status: "REVOKED" as const }, { approverId: "author" }, { approvedAt: null }]) expect(evidenceIsCurrent({ ...approved, ...patch }, releaseSha, now)).toBe(false);
    expect(evidenceIsCurrent(approved, "b".repeat(40), now)).toBe(false);
    expect(evidenceIsCurrent(approved, undefined, now)).toBe(false);
    expect(evidenceIsCurrent(approved, releaseSha, new Date("2026-10-07T02:00:00Z"))).toBe(false);
  });
  it("requires separate financial authorization references for real-money acceptance", () => {
    const live = { kind: "LIVE", key: "refund_acceptance", releaseSha, observedAt: evidence.observedAt, expiresAt: evidence.expiresAt, evidenceReference: evidence.evidenceReference, reason: evidence.reason, genuineOperatorAcceptance: true, financialAuthorizationReference: null };
    expect(AcceptanceEvidenceSchema.safeParse(live).success).toBe(false);
    expect(AcceptanceEvidenceSchema.safeParse({ ...live, financialAuthorizationReference: "operator:authorization-1" }).success).toBe(true);
    expect(AcceptanceEvidenceSchema.safeParse({ ...live, key: "current_ci_certification" }).success).toBe(false);
  });
});
