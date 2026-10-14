import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { prepareOwnerSelectedCommissionDefaults } from "@/lib/commercial/owner-selected-commission-defaults";
import { createCommissionPlan } from "@/lib/services/commission-plan.service";
import { createUser, uniqueTag } from "./phase7-5-fixtures";

describe("owner-selected commission defaults on disposable PostgreSQL", () => {
  beforeAll(() => {
    const url = new URL(process.env.DATABASE_URL ?? "postgres://localhost/absent");
    if (process.env.KT_ALLOW_ISOLATED_POSTGRES_TESTS !== "1" || !["localhost", "127.0.0.1"].includes(url.hostname) || url.pathname !== "/kt_launch_test") throw new Error("Disposable closure database required; no skipped proof.");
  });
  afterAll(async () => { await prisma.$disconnect(); });
  it("prepares 8% editable store drafts, preserves existing terms and never invents approval or charges", async () => {
    const tag = uniqueTag("commission-defaults");
    const maker = await createUser(`${tag}-maker`, "SUPER_ADMIN");
    const owner = await createUser(`${tag}-owner`, "STORE");
    const store = await prisma.store.create({ data: { name: "Disposable default commission store", slug: `${tag}-new`, ownerUserId: owner.id, status: "ACTIVE" } });
    const existing = await prisma.store.create({ data: { name: "Disposable negotiated commission store", slug: `${tag}-existing`, ownerUserId: owner.id, status: "ACTIVE" } });
    const pending = await prisma.store.create({ data: { name: "Disposable pending store", slug: `${tag}-pending`, ownerUserId: owner.id, status: "PENDING" } });
    const prior = await createCommissionPlan({ actorUserId: maker.id, operationId: `${tag}:negotiated`, subjectType: "MARKETPLACE_STORE_ORDER", scopeKey: `STORE:${existing.id}`, basisType: "ORDER_SUBTOTAL", effectiveFrom: new Date().toISOString(), calculationVersion: "negotiated-store-terms", rules: [{ ruleCode: "NEGOTIATED", allocationType: "PLATFORM_COMMISSION_REVENUE", beneficiaryType: "PLATFORM", calculationMethod: "PERCENTAGE_BPS", rateBasisPoints: 1000, priority: 1 }] });
    const existingCourier = await prisma.commissionPlan.findFirst({ where: { subjectType: "COURIER_ORDER", scopeKey: "GLOBAL:COURIER_ORDER" }, include: { rules: true } });
    const result = await prepareOwnerSelectedCommissionDefaults(maker.id);
    expect(result).toMatchObject({ status: "DRAFT", independentReviewRequired: true });
    const plans = await prisma.commissionPlan.findMany({ where: { scopeKey: `STORE:${store.id}` }, include: { rules: true, statusHistory: true } });
    expect(plans).toHaveLength(1);
    expect(plans[0]).toMatchObject({ status: "DRAFT", basisType: "ORDER_SUBTOTAL", approvedByUserId: null, submittedByUserId: null, activatedAt: null });
    expect(plans[0]!.rules).toHaveLength(1);
    expect(plans[0]!.rules[0]).toMatchObject({ calculationMethod: "PERCENTAGE_BPS", rateBasisPoints: 800, beneficiaryType: "PLATFORM" });
    expect(plans[0]!.statusHistory).toHaveLength(1);
    expect(await prisma.commissionAccrual.count({ where: { planId: plans[0]!.id } })).toBe(0);
    expect(await prisma.commissionPlan.findMany({ where: { scopeKey: `STORE:${existing.id}` }, include: { rules: true } })).toMatchObject([{ id: prior.id, rules: [{ rateBasisPoints: 1000 }] }]);
    expect(await prisma.commissionPlan.count({ where: { scopeKey: `STORE:${pending.id}` } })).toBe(0);
    const courier = await prisma.commissionPlan.findMany({ where: { subjectType: "COURIER_ORDER", scopeKey: "GLOBAL:COURIER_ORDER" }, include: { rules: true } });
    if (existingCourier) expect(courier.find(p => p.id === existingCourier.id)).toEqual(existingCourier);
    else expect(courier).toMatchObject([{ status: "DRAFT", rules: [{ rateBasisPoints: 3000 }] }]);
    const count = await prisma.commissionPlan.count();
    expect((await prepareOwnerSelectedCommissionDefaults(maker.id)).prepared).toBe(0);
    expect(await prisma.commissionPlan.count()).toBe(count);
    expect(await prisma.adminActivityLog.count({ where: { entityType: "CommissionPlan", entityId: plans[0]!.id } })).toBe(1);
  });
});
