import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { createCommissionPlan, updateDraftCommissionPlan, submitCommissionPlan, approveCommissionPlan, activateCommissionPlan, retireCommissionPlan } from "@/lib/services/commission-plan.service";
import { resolveActiveCommissionPlan } from "@/lib/services/commission-plan-query.service";
import { createUser, uniqueTag } from "./phase7-5-fixtures";

describe("commission policy persistence and independent review on disposable PostgreSQL", () => {
  let maker: string; let checker: string;
  const tag = uniqueTag("closure-commission");
  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL ?? "postgres://localhost/absent");
    if (process.env.KT_ALLOW_ISOLATED_POSTGRES_TESTS !== "1" || !["localhost", "127.0.0.1"].includes(url.hostname) || url.pathname !== "/kt_launch_test") throw new Error("Disposable closure database required; no skipped proof.");
    maker = (await createUser(`${tag}-maker`, "SUPER_ADMIN")).id; checker = (await createUser(`${tag}-checker`, "SUPER_ADMIN")).id;
  });
  afterAll(async () => { await prisma.$disconnect(); });
  it("persists lifecycle evidence, denies self-approval, checks activation and overlap, and fails closed without an active plan", async () => {
    const input = { subjectType: "COURIER_ORDER" as const, scopeKey: "GLOBAL:COURIER_ORDER" as const, basisType: "ORDER_SUBTOTAL" as const, effectiveFrom: new Date(Date.now() - 1000).toISOString(), effectiveUntil: new Date(Date.now() + 60000).toISOString(), calculationVersion: "disposable-closure-test", rules: [{ ruleCode: "DISPOSABLE_PLATFORM", allocationType: "PLATFORM_COMMISSION_REVENUE" as const, beneficiaryType: "PLATFORM" as const, calculationMethod: "FIXED_AMOUNT" as const, fixedAmount: "1.00", priority: 1 }], actorUserId: maker, operationId: `${tag}:draft` };
    const draft = await createCommissionPlan(input); expect(draft.status).toBe("DRAFT");
    await submitCommissionPlan(draft.id, maker, `${tag}:submit`);
    await expect(approveCommissionPlan(draft.id, maker, `${tag}:self-review`)).rejects.toMatchObject({ code: "COMMISSION_MAKER_CHECKER_REQUIRED" });
    const approved = await approveCommissionPlan(draft.id, checker, `${tag}:approve`); expect(approved.approvedByUserId).toBe(checker);
    await expect(activateCommissionPlan(draft.id, checker, `${tag}:production-locked`)).rejects.toMatchObject({ code: "COMMISSION_PRODUCTION_LOCKED" });
    const active = await activateCommissionPlan(draft.id, checker, `${tag}:test-activate`, { allowTestOnlyBypass: true }); expect(active.status).toBe("ACTIVE");
    expect((await resolveActiveCommissionPlan({ subjectType: "COURIER_ORDER", scopeKey: "GLOBAL:COURIER_ORDER", authoritativeAt: new Date() })).id).toBe(draft.id);
    const other = await createCommissionPlan({ ...input, operationId: `${tag}:other-draft` });
    await submitCommissionPlan(other.id, maker, `${tag}:other-submit`); await approveCommissionPlan(other.id, checker, `${tag}:other-approve`);
    await expect(activateCommissionPlan(other.id, checker, `${tag}:overlap`, { allowTestOnlyBypass: true })).rejects.toMatchObject({ code: "COMMISSION_POLICY_OVERLAP" });
    await retireCommissionPlan(draft.id, checker, `${tag}:retire`);
    await expect(resolveActiveCommissionPlan({ subjectType: "COURIER_ORDER", scopeKey: "GLOBAL:COURIER_ORDER", authoritativeAt: new Date() })).rejects.toMatchObject({ code: "COMMISSION_POLICY_NOT_FOUND" });
    expect(await prisma.commissionPlanStatusHistory.count({ where: { planId: draft.id } })).toBe(5);
  });
  it("authors store-specific policy with independent review while production activation remains locked", async () => {
    const owner = await createUser(`${tag}-store-owner`, "STORE");
    const store = await prisma.store.create({ data: { name: "Disposable commission store", slug: `${tag}-store`, ownerUserId: owner.id, status: "ACTIVE" } });
    const other = await prisma.store.create({ data: { name: "Another disposable commission store", slug: `${tag}-other`, ownerUserId: owner.id, status: "ACTIVE" } });
    const input = { subjectType: "MARKETPLACE_STORE_ORDER" as const, scopeKey: `STORE:${store.id}`, basisType: "ORDER_SUBTOTAL" as const, effectiveFrom: new Date(Date.now() - 1000).toISOString(), calculationVersion: "disposable-store-commission", rules: [{ ruleCode: "DISPOSABLE_PLATFORM", allocationType: "PLATFORM_COMMISSION_REVENUE" as const, beneficiaryType: "PLATFORM" as const, calculationMethod: "FIXED_AMOUNT" as const, fixedAmount: "1.00", priority: 1 }], actorUserId: maker, operationId: `${tag}:store-draft` };
    await expect(createCommissionPlan({ ...input, basisType: "ORDER_TOTAL" })).rejects.toMatchObject({ code: "COMMISSION_INVALID_PLAN" });
    const draft = await createCommissionPlan(input);
    expect(draft).toMatchObject({ status: "DRAFT", subjectType: "MARKETPLACE_STORE_ORDER", scopeKey: `STORE:${store.id}` });
    await expect(updateDraftCommissionPlan(draft.id, { ...input, scopeKey: `STORE:${other.id}`, expectedVersion: draft.version })).rejects.toMatchObject({ code: "COMMISSION_INVALID_PLAN" });
    await expect(updateDraftCommissionPlan(draft.id, { ...input, expectedVersion: draft.version + 1 })).rejects.toMatchObject({ code: "COMMISSION_IDEMPOTENCY_CONFLICT" });
    const saved = await updateDraftCommissionPlan(draft.id, { ...input, expectedVersion: draft.version });
    expect(saved.version).toBe(draft.version + 1);
    await submitCommissionPlan(draft.id, maker, `${tag}:store-submit`);
    await expect(approveCommissionPlan(draft.id, maker, `${tag}:store-self-approve`)).rejects.toMatchObject({ code: "COMMISSION_MAKER_CHECKER_REQUIRED" });
    const approved = await approveCommissionPlan(draft.id, checker, `${tag}:store-approve`);
    expect(approved.approvedByUserId).toBe(checker);
    await expect(activateCommissionPlan(draft.id, checker, `${tag}:store-production-locked`)).rejects.toMatchObject({ code: "COMMISSION_PRODUCTION_LOCKED" });
    expect(await prisma.commissionAccrual.count({ where: { planId: draft.id } })).toBe(0);
    expect(await prisma.commissionPlan.findUnique({ where: { id: draft.id } })).toMatchObject({ status: "APPROVED" });
  });
});
