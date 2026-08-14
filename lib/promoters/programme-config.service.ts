/* eslint-disable @typescript-eslint/no-explicit-any -- generated Prisma delegates are validated at build time. */
import { createHash, randomUUID } from "node:crypto";
import { PromoterError } from "./errors";
import { assertPromotersProductionReady } from "./production-readiness";

type Db = any;
type Input = Record<string, any>;
const operation = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,119}$/;
const code = /^[A-Z][A-Z0-9_]{1,63}$/;
const reference = (prefix: string) => `${prefix}-${randomUUID().replaceAll("-", "").toUpperCase()}`;
const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

function command(input: Input) { if (!operation.test(input.operationId ?? "")) throw new PromoterError("PROMOTER_INVALID_COMMAND", "A stable operation ID is required."); }
function definitions(input: Input) {
  if (!Array.isArray(input.rankDefinitions) || !input.rankDefinitions.length || !Array.isArray(input.qualificationRules)) throw new PromoterError("PROMOTER_INVALID_COMMAND", "Ranks and qualification rules are required for a programme version.");
  const rankCodes = new Set<string>(); const rankOrders = new Set<number>(); const ruleCodes = new Set<string>();
  for (const rank of input.rankDefinitions) {
    if (!code.test(rank?.code ?? "") || !String(rank?.displayName ?? "").trim() || !Number.isInteger(rank?.rankOrder) || rank.rankOrder < 0 || !Array.isArray(rank.qualificationRuleCodes) || rankCodes.has(rank.code) || rankOrders.has(rank.rankOrder)) throw new PromoterError("PROMOTER_INVALID_COMMAND", "Rank definitions are malformed or duplicate.");
    rankCodes.add(rank.code); rankOrders.add(rank.rankOrder);
  }
  for (const rule of input.qualificationRules) {
    if (!code.test(rule?.code ?? "") || !["DIRECT_REFERRAL_COUNT", "QUALIFIED_TARGET_COUNT", "MONTHLY_ACTIVITY_COUNT", "TEAM_MEMBER_COUNT", "TEAM_QUALIFIED_COUNT", "QUALIFYING_TRANSACTION_COUNT", "QUALIFYING_REVENUE_AMOUNT"].includes(rule?.type) || !rule?.configuration || typeof rule.configuration !== "object" || ruleCodes.has(rule.code)) throw new PromoterError("PROMOTER_INVALID_COMMAND", "Qualification rules are malformed or duplicate.");
    ruleCodes.add(rule.code);
  }
  for (const rank of input.rankDefinitions) if (rank.qualificationRuleCodes.some((item: unknown) => typeof item !== "string" || !ruleCodes.has(item))) throw new PromoterError("PROMOTER_INVALID_COMMAND", "Each rank may reference only rules in its programme version.");
}

/** Creates an effective-dated draft with immutable rank and rule definitions. */
export class PromoterProgrammeConfigService {
  constructor(private readonly db: Db) {}

  async createVersion(input: Input) {
    assertPromotersProductionReady(); command(input); definitions(input);
    const requestHash = input.requestHash ?? hash(input);
    return this.db.$transaction(async (tx: Db) => {
      const intent = await tx.promoterEventIntent.findUnique({ where: { operationId: `event:${input.operationId}` } });
      if (intent) { const replay = await tx.promoterProgramVersion.findUnique({ where: { publicReference: intent.aggregateReference } }); if (replay) return replay; }
      const programme = await tx.promoterProgram.findFirst({ where: { publicReference: input.programReference } });
      if (!programme) throw new PromoterError("PROMOTER_INVALID_COMMAND", "Promoter programme was not found.");
      if (input.targetType && input.targetType !== programme.targetType) throw new PromoterError("PROMOTER_INVALID_COMMAND", "Programme target type cannot change across versions.");
      const latest = await tx.promoterProgramVersion.aggregate({ where: { programId: programme.id }, _max: { versionNumber: true } });
      const current = await tx.promoterProgramVersion.findFirst({ where: { programId: programme.id, status: { in: ["APPROVED", "ACTIVE", "PAUSED"] }, OR: [{ endsAt: null }, { endsAt: { gt: new Date(input.startsAt) } }] } });
      if (current) throw new PromoterError("PROMOTER_INVALID_COMMAND", "End the current effective version before creating an overlapping version.");
      const version = await tx.promoterProgramVersion.create({ data: {
        publicReference: input.publicReference ?? reference("PPV"), programId: programme.id, versionNumber: (latest._max.versionNumber ?? 0) + 1,
        status: "DRAFT", attributionWindowDays: input.attributionWindowDays, qualifyingEventType: input.qualifyingEventType,
        qualificationHoldDays: input.qualificationHoldDays, commissionPlanVersionId: input.commissionPlanVersionId,
        maximumQualificationsPerPromoter: input.maximumQualificationsPerPromoter ?? null, maximumQualificationsPerDay: input.maximumQualificationsPerDay ?? null,
        maximumQualificationsPerSubject: input.maximumQualificationsPerSubject ?? null, geographicPolicyVersion: input.geographicPolicyVersion,
        fraudPolicyVersion: input.fraudPolicyVersion, disclosurePolicyVersion: input.disclosurePolicyVersion, reversalPolicyVersion: input.reversalPolicyVersion,
        legalTermsVersion: input.legalTermsVersion, teamRules: input.teamRules ?? null, bonusRules: input.bonusRules ?? null, startsAt: new Date(input.startsAt), endsAt: input.endsAt ? new Date(input.endsAt) : null,
      } });
      await tx.promoterQualificationRule.createMany({ data: input.qualificationRules.map((rule: Input) => ({ publicReference: reference("PQR"), programVersionId: version.id, code: rule.code, type: rule.type, configuration: rule.configuration, required: rule.required !== false })) });
      await tx.promoterRankDefinition.createMany({ data: input.rankDefinitions.map((rank: Input) => ({ publicReference: reference("PRD"), programVersionId: version.id, code: rank.code, displayName: rank.displayName, rankOrder: rank.rankOrder, qualificationRuleCodes: rank.qualificationRuleCodes, benefitConfiguration: rank.benefitConfiguration ?? null })) });
      await tx.promoterEventIntent.create({ data: { eventType: "PROMOTER_PROGRAM_ENROLLED", aggregateReference: version.publicReference, operationId: `event:${input.operationId}`, safePayload: { action: "PROGRAMME_VERSION_DRAFTED", requestHash } } });
      return version;
    });
  }

  async activateVersion(input: Input) {
    assertPromotersProductionReady(); command(input);
    return this.db.$transaction(async (tx: Db) => {
      const version = await tx.promoterProgramVersion.findFirst({ where: { publicReference: input.versionReference }, include: { rankDefinitions: true, qualificationRules: true } });
      if (!version || version.status !== "APPROVED" || !version.rankDefinitions.length || !version.qualificationRules.length) throw new PromoterError("PROMOTER_NOT_ELIGIBLE", "Only an approved complete programme version may activate.");
      const existing = await tx.promoterProgramVersion.findFirst({ where: { programId: version.programId, status: "ACTIVE", id: { not: version.id }, OR: [{ endsAt: null }, { endsAt: { gt: version.startsAt } }] } });
      if (existing) throw new PromoterError("PROMOTER_INVALID_COMMAND", "An overlapping programme version is already active.");
      const row = await tx.promoterProgramVersion.update({ where: { id: version.id }, data: { status: "ACTIVE", activatedAt: new Date() } });
      await tx.promoterProgram.update({ where: { id: version.programId }, data: { status: "ACTIVE" } });
      await tx.promoterEventIntent.create({ data: { eventType: "PROMOTER_PROGRAM_ENROLLED", aggregateReference: row.publicReference, operationId: `event:${input.operationId}`, safePayload: { action: "PROGRAMME_VERSION_ACTIVATED", actorUserId: input.actorUserId ?? null } } });
      return row;
    });
  }

  async getVersion(referenceValue: string) {
    assertPromotersProductionReady();
    return this.db.promoterProgramVersion.findFirst({ where: { publicReference: referenceValue }, include: { program: true, rankDefinitions: { orderBy: { rankOrder: "asc" } }, qualificationRules: { orderBy: { code: "asc" } } } });
  }
}
