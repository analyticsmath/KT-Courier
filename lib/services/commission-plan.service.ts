import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { assertCommissionPlanTransition } from "@/lib/commissions/commission-plan-state-machine";
import { assertCommissionProductionReady } from "@/lib/commissions/commission-production-readiness";
import { CommissionError } from "@/lib/commissions/errors";

type PlanRuleInput = Readonly<{
  ruleCode: string;
  allocationType: "PLATFORM_COMMISSION_REVENUE" | "BENEFICIARY_COMMISSION_PAYABLE";
  beneficiaryType: "PLATFORM" | "PROMOTER";
  calculationMethod: "PERCENTAGE_BPS" | "FIXED_AMOUNT";
  rateBasisPoints?: number;
  fixedAmount?: string;
  minimumAmount?: string;
  maximumAmount?: string;
  priority: number;
  isRequired?: boolean;
}>;

type PlanDraftInput = Readonly<{
  subjectType: "COURIER_ORDER";
  scopeKey: "GLOBAL:COURIER_ORDER";
  basisType: "ORDER_SUBTOTAL" | "ORDER_TOTAL";
  effectiveFrom: string;
  effectiveUntil?: string | null;
  calculationVersion: string;
  rules: readonly PlanRuleInput[];
}>;

const MONEY = /^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/;
const ref = (prefix: string) => `${prefix}-${randomUUID().replaceAll("-", "").toUpperCase()}`;

function date(value: string, field: string): Date {
  const parsed = new Date(value);
  if (!value || Number.isNaN(parsed.valueOf())) throw new CommissionError("COMMISSION_INVALID_PLAN", `${field} must be an ISO timestamp.`);
  return parsed;
}

function decimal(value: string | undefined, field: string): Prisma.Decimal | null {
  if (value === undefined) return null;
  if (!MONEY.test(value)) throw new CommissionError("COMMISSION_INVALID_RULE", `${field} must be an exact non-negative money string.`);
  return new Prisma.Decimal(value);
}

function normalizedRules(rules: readonly PlanRuleInput[]) {
  if (rules.length === 0) throw new CommissionError("COMMISSION_INVALID_PLAN", "A commission plan requires at least one rule.");
  const codes = new Set<string>(); const priorities = new Set<number>(); let bpsTotal = 0;
  const normalized = rules.map((rule) => {
    const ruleCode = rule.ruleCode.trim().toUpperCase();
    if (!/^[A-Z][A-Z0-9_]{1,63}$/.test(ruleCode) || codes.has(ruleCode) || !Number.isInteger(rule.priority) || priorities.has(rule.priority)) {
      throw new CommissionError("COMMISSION_INVALID_RULE", "Commission rule codes and priorities must be unique and deterministic.");
    }
    codes.add(ruleCode); priorities.add(rule.priority);
    const fixedAmount = decimal(rule.fixedAmount, "fixedAmount"); const minimumAmount = decimal(rule.minimumAmount, "minimumAmount"); const maximumAmount = decimal(rule.maximumAmount, "maximumAmount");
    if (minimumAmount?.lessThan(0) || maximumAmount?.lessThan(0) || (minimumAmount && maximumAmount && minimumAmount.greaterThan(maximumAmount))) throw new CommissionError("COMMISSION_INVALID_RULE", "Commission rule limits are invalid.");
    if ((rule.allocationType === "PLATFORM_COMMISSION_REVENUE") !== (rule.beneficiaryType === "PLATFORM")) throw new CommissionError("COMMISSION_INVALID_RULE", "Commission allocation and beneficiary semantics do not match.");
    if (rule.calculationMethod === "PERCENTAGE_BPS") {
      if (!Number.isInteger(rule.rateBasisPoints) || rule.rateBasisPoints! < 0 || rule.rateBasisPoints! > 10_000 || fixedAmount) throw new CommissionError("COMMISSION_INVALID_RULE", "Percentage commission rules require 0–10000 integer basis points only.");
      bpsTotal += rule.rateBasisPoints!;
    } else if (!fixedAmount || rule.rateBasisPoints !== undefined) {
      throw new CommissionError("COMMISSION_INVALID_RULE", "Fixed commission rules require exactly one fixed amount.");
    }
    return { publicReference: ref("CR"), ruleCode, allocationType: rule.allocationType, beneficiaryType: rule.beneficiaryType, calculationMethod: rule.calculationMethod, rateBasisPoints: rule.calculationMethod === "PERCENTAGE_BPS" ? rule.rateBasisPoints! : null, fixedAmount, minimumAmount, maximumAmount, priority: rule.priority, isRequired: rule.isRequired === true };
  }).sort((left, right) => left.priority - right.priority);
  if (bpsTotal > 10_000) throw new CommissionError("COMMISSION_INVALID_RULE", "Total percentage rates may not exceed 10000 basis points.");
  return normalized;
}

function normalizedDraft(input: PlanDraftInput) {
  if (input.subjectType !== "COURIER_ORDER" || input.scopeKey !== "GLOBAL:COURIER_ORDER" || !input.calculationVersion.trim()) throw new CommissionError("COMMISSION_INVALID_PLAN", "Only the canonical global courier-order scope is supported.");
  const effectiveFrom = date(input.effectiveFrom, "effectiveFrom"); const effectiveUntil = input.effectiveUntil ? date(input.effectiveUntil, "effectiveUntil") : null;
  if (effectiveUntil && effectiveUntil <= effectiveFrom) throw new CommissionError("COMMISSION_INVALID_PLAN", "effectiveUntil must be after effectiveFrom.");
  return { ...input, effectiveFrom, effectiveUntil, calculationVersion: input.calculationVersion.trim(), rules: normalizedRules(input.rules) };
}

const planInclude = { rules: { orderBy: { priority: "asc" as const } }, createdBy: { select: { id: true, name: true, email: true } }, submittedBy: { select: { id: true, name: true, email: true } }, approvedBy: { select: { id: true, name: true, email: true } } } satisfies Prisma.CommissionPlanInclude;

export async function createCommissionPlan(input: PlanDraftInput & Readonly<{ actorUserId: string; operationId: string }>) {
  const draft = normalizedDraft(input);
  const result = await prisma.$transaction(async (tx) => {
    const latest = await tx.commissionPlan.aggregate({ where: { subjectType: draft.subjectType, scopeKey: draft.scopeKey, currency: "ZAR" }, _max: { versionNumber: true } });
    return tx.commissionPlan.create({ data: { publicReference: ref("CP"), subjectType: draft.subjectType, scopeKey: draft.scopeKey, currency: "ZAR", versionNumber: (latest._max.versionNumber ?? 0) + 1, status: "DRAFT", basisType: draft.basisType, effectiveFrom: draft.effectiveFrom, effectiveUntil: draft.effectiveUntil, createdByUserId: input.actorUserId, calculationVersion: draft.calculationVersion, rules: { create: draft.rules }, statusHistory: { create: { fromStatus: null, toStatus: "DRAFT", actorUserId: input.actorUserId, operationId: input.operationId, reasonCode: "PLAN_CREATED" } } }, include: planInclude });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  return result;
}

export async function updateDraftCommissionPlan(planId: string, input: PlanDraftInput & Readonly<{ actorUserId: string }>) {
  const draft = normalizedDraft(input);
  return prisma.$transaction(async (tx) => {
    const plan = await tx.commissionPlan.findUnique({ where: { id: planId }, select: { id: true, status: true, createdByUserId: true } });
    if (!plan) throw new CommissionError("COMMISSION_PLAN_NOT_FOUND", "Commission plan was not found.");
    if (plan.status !== "DRAFT") throw new CommissionError("COMMISSION_INVALID_STATE", "Only draft commission plans can be changed.");
    if (plan.createdByUserId !== input.actorUserId) throw new CommissionError("COMMISSION_INVALID_STATE", "Only the plan maker may edit its draft.");
    await tx.commissionRule.deleteMany({ where: { planId } });
    return tx.commissionPlan.update({ where: { id: planId }, data: { basisType: draft.basisType, effectiveFrom: draft.effectiveFrom, effectiveUntil: draft.effectiveUntil, calculationVersion: draft.calculationVersion, version: { increment: 1 }, rules: { create: draft.rules } }, include: planInclude });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

async function transitionPlan(planId: string, actorUserId: string, operationId: string, to: "UNDER_REVIEW" | "APPROVED" | "REJECTED" | "ACTIVE" | "RETIRED", options?: Readonly<{ allowTestOnlyBypass?: boolean }>) {
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{7,119}$/.test(operationId)) throw new CommissionError("COMMISSION_INVALID_COMMAND", "A valid commission plan operation ID is required.");
  return prisma.$transaction(async (tx) => {
    const prior = await tx.commissionPlanStatusHistory.findUnique({ where: { planId_operationId: { planId, operationId } } });
    if (prior) {
      if (prior.toStatus !== to) throw new CommissionError("COMMISSION_IDEMPOTENCY_CONFLICT", "The operation ID is associated with a different commission plan transition.");
      const receipt = await tx.commissionPlan.findUnique({ where: { id: planId }, include: planInclude });
      if (receipt) return receipt;
    }
    const plan = await tx.commissionPlan.findUnique({ where: { id: planId }, include: { rules: { orderBy: { priority: "asc" } } } });
    if (!plan) throw new CommissionError("COMMISSION_PLAN_NOT_FOUND", "Commission plan was not found.");
    assertCommissionPlanTransition(plan.status, to);
    if (to === "UNDER_REVIEW" || to === "ACTIVE") normalizedRules(plan.rules.map((rule) => ({ ...rule, fixedAmount: rule.fixedAmount?.toFixed(2), minimumAmount: rule.minimumAmount?.toFixed(2), maximumAmount: rule.maximumAmount?.toFixed(2), rateBasisPoints: rule.rateBasisPoints ?? undefined })));
    if (to === "APPROVED" && plan.createdByUserId === actorUserId) throw new CommissionError("COMMISSION_MAKER_CHECKER_REQUIRED", "The plan creator cannot approve the same policy version.");
    if (to === "ACTIVE") {
      assertCommissionProductionReady(options);
      if (!plan.approvedByUserId || plan.approvedByUserId === plan.createdByUserId || plan.rules.length === 0) throw new CommissionError("COMMISSION_MAKER_CHECKER_REQUIRED", "Activation requires an independently approved plan with rules.");
      const overlap = await tx.commissionPlan.findFirst({ where: { id: { not: plan.id }, subjectType: plan.subjectType, scopeKey: plan.scopeKey, currency: plan.currency, status: "ACTIVE", effectiveFrom: { lt: plan.effectiveUntil ?? new Date("9999-12-31T00:00:00.000Z") }, OR: [{ effectiveUntil: null }, { effectiveUntil: { gt: plan.effectiveFrom } }] }, select: { id: true } });
      if (overlap) throw new CommissionError("COMMISSION_POLICY_OVERLAP", "An active commission policy already covers this effective period.");
    }
    const now = new Date();
    return tx.commissionPlan.update({ where: { id: plan.id }, data: { status: to, version: { increment: 1 }, ...(to === "UNDER_REVIEW" ? { submittedByUserId: actorUserId, submittedAt: now } : {}), ...(to === "APPROVED" ? { approvedByUserId: actorUserId, approvedAt: now } : {}), ...(to === "ACTIVE" ? { activatedAt: now } : {}), ...(to === "RETIRED" ? { retiredByUserId: actorUserId, retiredAt: now } : {}), statusHistory: { create: { fromStatus: plan.status, toStatus: to, actorUserId, operationId, reasonCode: `PLAN_${to}` } } }, include: planInclude });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export const submitCommissionPlan = (planId: string, actorUserId: string, operationId: string) => transitionPlan(planId, actorUserId, operationId, "UNDER_REVIEW");
export const approveCommissionPlan = (planId: string, actorUserId: string, operationId: string) => transitionPlan(planId, actorUserId, operationId, "APPROVED");
export const rejectCommissionPlan = (planId: string, actorUserId: string, operationId: string) => transitionPlan(planId, actorUserId, operationId, "REJECTED");
export const activateCommissionPlan = (planId: string, actorUserId: string, operationId: string, options?: Readonly<{ allowTestOnlyBypass?: boolean }>) => transitionPlan(planId, actorUserId, operationId, "ACTIVE", options);
export const retireCommissionPlan = (planId: string, actorUserId: string, operationId: string) => transitionPlan(planId, actorUserId, operationId, "RETIRED");
