import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { CommissionError } from "@/lib/commissions/errors";

const include = { rules: { orderBy: { priority: "asc" as const } }, createdBy: { select: { id: true, name: true, email: true } }, submittedBy: { select: { id: true, name: true, email: true } }, approvedBy: { select: { id: true, name: true, email: true } }, statusHistory: { orderBy: { createdAt: "asc" as const }, select: { fromStatus: true, toStatus: true, operationId: true, reasonCode: true, createdAt: true, actor: { select: { name: true, email: true } } } } } satisfies Prisma.CommissionPlanInclude;

function dto(row: Prisma.CommissionPlanGetPayload<{ include: typeof include }>) {
  return Object.freeze({ id: row.id, publicReference: row.publicReference, subjectType: row.subjectType, scopeKey: row.scopeKey, currency: "ZAR" as const, versionNumber: row.versionNumber, status: row.status, basisType: row.basisType, effectiveFrom: row.effectiveFrom.toISOString(), effectiveUntil: row.effectiveUntil?.toISOString() ?? null, calculationVersion: row.calculationVersion, createdBy: row.createdBy ? { id: row.createdBy.id, label: row.createdBy.name ?? row.createdBy.email } : null, submittedBy: row.submittedBy ? { id: row.submittedBy.id, label: row.submittedBy.name ?? row.submittedBy.email } : null, approvedBy: row.approvedBy ? { id: row.approvedBy.id, label: row.approvedBy.name ?? row.approvedBy.email } : null, rules: Object.freeze(row.rules.map((rule) => Object.freeze({ publicReference: rule.publicReference, ruleCode: rule.ruleCode, allocationType: rule.allocationType, beneficiaryType: rule.beneficiaryType, calculationMethod: rule.calculationMethod, rateBasisPoints: rule.rateBasisPoints, fixedAmount: rule.fixedAmount?.toFixed(2) ?? null, minimumAmount: rule.minimumAmount?.toFixed(2) ?? null, maximumAmount: rule.maximumAmount?.toFixed(2) ?? null, priority: rule.priority, isRequired: rule.isRequired }))), history: Object.freeze(row.statusHistory.map((entry) => Object.freeze({ fromStatus: entry.fromStatus, toStatus: entry.toStatus, operationId: entry.operationId, reasonCode: entry.reasonCode, actorLabel: entry.actor.name ?? entry.actor.email, createdAt: entry.createdAt.toISOString() }))) });
}

export async function listCommissionPlans(query: Readonly<{ status?: "DRAFT" | "UNDER_REVIEW" | "APPROVED" | "ACTIVE" | "RETIRED" | "REJECTED"; page: number; pageSize: number }>) {
  const where = query.status ? { status: query.status } : {};
  const [total, rows] = await prisma.$transaction([prisma.commissionPlan.count({ where }), prisma.commissionPlan.findMany({ where, include, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (query.page - 1) * query.pageSize, take: query.pageSize })]);
  return Object.freeze({ data: Object.freeze(rows.map(dto)), pagination: Object.freeze({ page: query.page, pageSize: query.pageSize, total, totalPages: Math.ceil(total / query.pageSize) }) });
}

export async function getCommissionPlan(id: string) {
  const plan = await prisma.commissionPlan.findUnique({ where: { id }, include });
  return plan ? dto(plan) : null;
}

export async function resolveActiveCommissionPlan(input: Readonly<{ subjectType: "COURIER_ORDER"; scopeKey: "GLOBAL:COURIER_ORDER"; authoritativeAt: Date }>) {
  const matches = await prisma.commissionPlan.findMany({ where: { subjectType: input.subjectType, scopeKey: input.scopeKey, currency: "ZAR", status: "ACTIVE", effectiveFrom: { lte: input.authoritativeAt }, OR: [{ effectiveUntil: null }, { effectiveUntil: { gt: input.authoritativeAt } }] }, include: { rules: { orderBy: { priority: "asc" } } }, take: 2 });
  if (matches.length === 0) throw new CommissionError("COMMISSION_POLICY_NOT_FOUND", "No active commission policy applies at the authoritative event time.");
  if (matches.length > 1) throw new CommissionError("COMMISSION_POLICY_OVERLAP", "More than one active commission policy applies at the authoritative event time.");
  return matches[0]!;
}
