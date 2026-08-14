/* eslint-disable @typescript-eslint/no-explicit-any -- generated Prisma delegates are validated at build time. */
import { createHash, randomUUID } from "node:crypto";
import { PromoterError } from "./errors";
import { assertPromotersProductionReady } from "./production-readiness";

type Db = any; type Input = Record<string, any>;
const op = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,119}$/;
const month = /^\d{4}-(0[1-9]|1[0-2])$/;
const ref = (prefix: string) => `${prefix}-${randomUUID().replaceAll("-", "").toUpperCase()}`;
const fingerprint = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
function command(input: Input) { if (!op.test(input.operationId ?? "")) throw new PromoterError("PROMOTER_INVALID_COMMAND", "A stable operation ID is required."); }
function bounds(periodKey: string) { if (!month.test(periodKey)) throw new PromoterError("PROMOTER_INVALID_COMMAND", "Period key must use YYYY-MM."); const [year, value] = periodKey.split("-").map(Number); return { start: new Date(Date.UTC(year, value - 1, 1)), end: new Date(Date.UTC(year, value, 1)) }; }
function minimum(configuration: any) { const value = Number(configuration?.minimum); if (!Number.isFinite(value) || value < 0) throw new PromoterError("PROMOTER_INVALID_COMMAND", "Qualification rule configuration requires a non-negative minimum."); return value; }

async function descendants(tx: Db, programVersionId: string, rootId: string, maxDepth: number) {
  const seen = new Set<string>([rootId]); let frontier = [rootId]; const result: string[] = [];
  for (let depth = 0; depth < maxDepth && frontier.length; depth += 1) {
    const edges = await tx.promoterTeamEdge.findMany({ where: { programVersionId, parentPromoterAccountId: { in: frontier }, effectiveUntil: null }, select: { childPromoterAccountId: true } });
    frontier = edges.map((edge: any) => edge.childPromoterAccountId).filter((id: string) => !seen.has(id));
    frontier.forEach((id: string) => seen.add(id)); result.push(...frontier);
  }
  return result;
}

/** The team graph keeps closed historical edges and delegates structural cycle safety to PostgreSQL. */
export class PromoterTeamQualificationService {
  constructor(private readonly db: Db) {}

  async reparent(input: Input) {
    assertPromotersProductionReady(); command(input);
    if (!input.parentPromoterAccountId || !input.childPromoterAccountId || input.parentPromoterAccountId === input.childPromoterAccountId) throw new PromoterError("PROMOTER_INVALID_COMMAND", "A promoter cannot parent itself.");
    const requestHash = input.requestHash ?? fingerprint(input);
    return this.db.$transaction(async (tx: Db) => {
      const replay = await tx.promoterTeamEdge.findUnique({ where: { operationId: input.operationId } });
      if (replay) { if (replay.requestHash !== requestHash) throw new PromoterError("PROMOTER_INVALID_COMMAND", "Operation request conflict."); return replay; }
      const [version, parent, child] = await Promise.all([
        tx.promoterProgramVersion.findFirst({ where: { id: input.programVersionId, status: "ACTIVE" } }),
        tx.promoterAccount.findFirst({ where: { id: input.parentPromoterAccountId, status: "ACTIVE" } }),
        tx.promoterAccount.findFirst({ where: { id: input.childPromoterAccountId, status: "ACTIVE" } }),
      ]);
      if (!version || !parent || !child) throw new PromoterError("PROMOTER_NOT_ELIGIBLE", "Active programme and promoter accounts are required for team membership.");
      await tx.promoterTeamEdge.updateMany({ where: { programVersionId: input.programVersionId, childPromoterAccountId: child.id, effectiveUntil: null }, data: { effectiveUntil: new Date() } });
      const edge = await tx.promoterTeamEdge.create({ data: { publicReference: ref("PTE"), programVersionId: input.programVersionId, parentPromoterAccountId: parent.id, childPromoterAccountId: child.id, attributionId: input.attributionId ?? null, operationId: input.operationId, requestHash, createdByUserId: input.actorUserId ?? null } });
      await tx.promoterEventIntent.create({ data: { eventType: "PROMOTER_PROGRAM_ENROLLED", aggregateReference: edge.publicReference, operationId: `event:${input.operationId}`, safePayload: { action: "TEAM_REPARENTED", parentPromoterAccountId: parent.id, childPromoterAccountId: child.id } } });
      return edge;
    });
  }

  async team(programVersionId: string, promoterAccountId: string, maxDepth = 6) {
    assertPromotersProductionReady(); const depth = Math.max(1, Math.min(12, Number(maxDepth) || 6));
    const ids = await descendants(this.db, programVersionId, promoterAccountId, depth);
    const accounts = ids.length ? await this.db.promoterAccount.findMany({ where: { id: { in: ids } }, select: { publicReference: true, displayName: true, status: true } }) : [];
    return { maxDepth: depth, members: accounts };
  }

  async evaluatePeriod(input: Input) {
    assertPromotersProductionReady(); command(input); const range = bounds(input.periodKey); const requestHash = input.requestHash ?? fingerprint(input);
    try { return await this.db.$transaction(async (tx: Db) => {
      const replay = await tx.promoterQualificationEvaluation.findUnique({ where: { operationId: input.operationId } });
      if (replay) { if (replay.requestHash !== requestHash) throw new PromoterError("PROMOTER_INVALID_COMMAND", "Operation request conflict."); return replay; }
      const existing = await tx.promoterQualificationEvaluation.findUnique({ where: { promoterAccountId_programVersionId_periodKey: { promoterAccountId: input.promoterAccountId, programVersionId: input.programVersionId, periodKey: input.periodKey } } });
      if (existing) return existing;
      const enrolment = await tx.promoterEnrollment.findFirst({ where: { promoterAccountId: input.promoterAccountId, programVersionId: input.programVersionId, status: "ACTIVE" } });
      const version = await tx.promoterProgramVersion.findFirst({ where: { id: input.programVersionId, status: { in: ["ACTIVE", "PAUSED"] } }, include: { qualificationRules: true, rankDefinitions: { orderBy: { rankOrder: "asc" } } } });
      if (!enrolment || !version) throw new PromoterError("PROMOTER_NOT_ELIGIBLE", "An enrolled promoter and effective programme version are required.");
      const teamIds = await descendants(tx, version.id, input.promoterAccountId, Math.max(1, Math.min(12, Number(input.maxTeamDepth) || 6)));
      const [direct, qualified, activity, qualifications] = await Promise.all([
        tx.promoterAttribution.count({ where: { promoterAccountId: input.promoterAccountId, programVersionId: version.id, attributedAt: { gte: range.start, lt: range.end } } }),
        tx.promoterAttribution.count({ where: { promoterAccountId: input.promoterAccountId, programVersionId: version.id, status: "QUALIFIED", attributedAt: { gte: range.start, lt: range.end } } }),
        tx.promoterTouch.count({ where: { promoterAccountId: input.promoterAccountId, programVersionId: version.id, validityStatus: "VALID", occurredAt: { gte: range.start, lt: range.end } } }),
        tx.promoterQualification.findMany({ where: { programVersionId: version.id, status: { in: ["QUALIFIED_HELD", "RELEASABLE", "RELEASED"] }, qualifiedAt: { gte: range.start, lt: range.end }, attribution: { promoterAccountId: input.promoterAccountId } }, select: { qualifyingAmount: true } }),
      ]);
      const teamQualified = teamIds.length ? await tx.promoterQualification.count({ where: { programVersionId: version.id, status: { in: ["QUALIFIED_HELD", "RELEASABLE", "RELEASED"] }, qualifiedAt: { gte: range.start, lt: range.end }, attribution: { promoterAccountId: { in: teamIds } } } }) : 0;
      const metrics: Record<string, number> = { DIRECT_REFERRAL_COUNT: direct, QUALIFIED_TARGET_COUNT: qualified, MONTHLY_ACTIVITY_COUNT: activity, TEAM_MEMBER_COUNT: teamIds.length, TEAM_QUALIFIED_COUNT: teamQualified, QUALIFYING_TRANSACTION_COUNT: qualifications.length, QUALIFYING_REVENUE_AMOUNT: qualifications.reduce((sum: number, item: any) => sum + Number(item.qualifyingAmount ?? 0), 0) };
      const ruleResults = version.qualificationRules.map((rule: any) => ({ code: rule.code, type: rule.type, required: rule.required, actual: metrics[rule.type] ?? 0, minimum: minimum(rule.configuration), passed: (metrics[rule.type] ?? 0) >= minimum(rule.configuration) }));
      const resultsByCode = new Map(ruleResults.map((item: any) => [item.code, item]));
      const qualifiedAll = ruleResults.filter((item: any) => item.required).every((item: any) => item.passed);
      const rank = version.rankDefinitions.filter((item: any) => Array.isArray(item.qualificationRuleCodes) && item.qualificationRuleCodes.every((ruleCode: string) => (resultsByCode.get(ruleCode) as any)?.passed)).at(-1) ?? null;
      const row = await tx.promoterQualificationEvaluation.create({ data: { publicReference: ref("PQE"), promoterAccountId: input.promoterAccountId, programVersionId: version.id, periodKey: input.periodKey, qualified: qualifiedAll, rankDefinitionId: rank?.id ?? null, result: { periodKey: input.periodKey, programVersionReference: version.publicReference, commissionPlanVersionId: version.commissionPlanVersionId, metrics, rules: ruleResults, rank: rank ? { code: rank.code, displayName: rank.displayName } : null }, operationId: input.operationId, requestHash } });
      await tx.promoterEventIntent.create({ data: { eventType: "PROMOTER_QUALIFICATION_CONFIRMED", aggregateReference: row.publicReference, operationId: `event:${input.operationId}`, safePayload: { action: "PERIOD_EVALUATED", periodKey: input.periodKey, qualified: qualifiedAll, rankReference: rank?.publicReference ?? null } } });
      return row;
    }); } catch (error: any) {
      if (error?.code === "P2002") { const existing = await this.db.promoterQualificationEvaluation.findUnique({ where: { promoterAccountId_programVersionId_periodKey: { promoterAccountId: input.promoterAccountId, programVersionId: input.programVersionId, periodKey: input.periodKey } } }); if (existing) return existing; }
      throw error;
    }
  }
}
