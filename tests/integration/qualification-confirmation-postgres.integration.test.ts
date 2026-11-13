import { createHash, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { requireDisposableStoreSettlementDatabase } from "@/scripts/disposable-store-settlement-guard";

// Isolated database test of the transition; the real production gate remains unchanged.
vi.mock("@/lib/promoters/production-readiness", () => ({ assertPromotersProductionReady: vi.fn() }));
import { confirmPromoterQualification } from "@/lib/promoters/qualification-earning.service";
import { PROCESSOR_HANDLERS } from "@/lib/processors/processor-service";

const marker = `promoter-confirm-${randomUUID()}`;
let qualificationId = "";
let validated = false;
beforeAll(async () => {
  requireDisposableStoreSettlementDatabase(); validated = true;
  const user = await prisma.user.create({ data: { email: `${marker}@example.test`, role: "CUSTOMER", status: "ACTIVE" } });
  const customer = await prisma.user.create({ data: { email: `${marker}-customer@example.test`, role: "CUSTOMER", status: "ACTIVE" } });
  const account = await prisma.promoterAccount.create({ data: { publicReference: `${marker}-account`, userId: user.id, legalName: "Disposable promoter" } });
  const program = await prisma.promoterProgram.create({ data: { publicReference: `${marker}-program`, code: marker, name: "Disposable", targetType: "CUSTOMER" } });
  const version = await prisma.promoterProgramVersion.create({ data: { publicReference: `${marker}-version`, programId: program.id, versionNumber: 1, attributionWindowDays: 30, qualifyingEventType: "CUSTOMER_FIRST_COMPLETED_SETTLED_COURIER_ORDER", qualificationHoldDays: 7, commissionPlanVersionId: "disposable", geographicPolicyVersion: "test", fraudPolicyVersion: "test", disclosurePolicyVersion: "test", reversalPolicyVersion: "test", legalTermsVersion: "test", startsAt: new Date() } });
  const enrollment = await prisma.promoterEnrollment.create({ data: { publicReference: `${marker}-enrollment`, promoterAccountId: account.id, programVersionId: version.id, operationId: `${marker}-enroll`, requestHash: marker } });
  const touch = await prisma.promoterTouch.create({ data: { publicReference: `${marker}-touch`, promoterAccountId: account.id, enrollmentId: enrollment.id, programVersionId: version.id, touchType: "LINK_VISIT", destinationType: "CUSTOMER", occurredAt: new Date(), operationId: `${marker}-touch`, requestHash: marker } });
  const attribution = await prisma.promoterAttribution.create({ data: { publicReference: `${marker}-attribution`, promoterAccountId: account.id, enrollmentId: enrollment.id, programVersionId: version.id, touchId: touch.id, subjectType: "CUSTOMER", customerUserId: customer.id, subjectKey: marker, expiresAt: new Date(Date.now() + 86400000), operationId: `${marker}-attribution`, requestHash: marker } });
  qualificationId = (await prisma.promoterQualification.create({ data: { publicReference: `${marker}-qualification`, attributionId: attribution.id, programVersionId: version.id, status: "EVIDENCE_OBSERVED", qualifyingEventType: "CUSTOMER_FIRST_COMPLETED_SETTLED_COURIER_ORDER", evidenceFingerprint: marker, operationId: `${marker}-evidence`, requestHash: marker } })).id;
});
afterAll(async () => { if (validated) await prisma.$disconnect(); });

it("confirms once across competing workers and replays the same operation", async () => {
  const operationId = `process-promoter-qualifications:${createHash("sha256").update(`${marker}-qualification`).digest("hex").slice(0, 32)}`;
  const context = { mode: "DRY_RUN" as const, batchSize: 250, operationId: `${marker}-run` };
  const preview = await PROCESSOR_HANDLERS["process-promoter-qualifications"](context);
  expect(preview.itemsExamined).toBeGreaterThanOrEqual(1);
  expect((await prisma.promoterQualification.findUniqueOrThrow({ where: { id: qualificationId } })).status).toBe("EVIDENCE_OBSERVED");
  await Promise.all([
    PROCESSOR_HANDLERS["process-promoter-qualifications"]({ ...context, mode: "APPLY" }),
    PROCESSOR_HANDLERS["process-promoter-qualifications"]({ ...context, mode: "APPLY" }),
  ]);
  const results = await Promise.all([confirmPromoterQualification(prisma, { qualificationId, operationId }), confirmPromoterQualification(prisma, { qualificationId, operationId })]);
  expect(results.map(row => row.status)).toEqual(["QUALIFIED_HELD", "QUALIFIED_HELD"]);
  expect(await prisma.promoterEventIntent.count({ where: { operationId, eventType: "PROMOTER_QUALIFICATION_CONFIRMED" } })).toBe(1);
  expect((await confirmPromoterQualification(prisma, { qualificationId, operationId })).status).toBe("QUALIFIED_HELD");
  await expect(confirmPromoterQualification(prisma, { qualificationId, operationId: `${marker}-different` })).rejects.toMatchObject({ code: "PROMOTER_NOT_ELIGIBLE" });
});

it("refuses a locked CLI apply without reporting success", () => {
  const result = spawnSync(process.execPath, ["scripts/process-promoter-qualifications.mjs", "--apply", "--limit=1"], { encoding: "utf8", timeout: 30000 });
  expect(result.status).not.toBe(0);
  expect(result.stderr).toContain("production lock CONSOLIDATED_VALIDATION_NOT_APPROVED prevented mutation");
});
