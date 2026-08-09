import { phase5Repository } from "@/lib/operations/phase5-repository";

export interface HoldEvaluationRequest {
  subjectType: string;
  subjectReference: string;
}

export interface HoldEvaluationResult {
  hasHold: boolean;
  activeHoldReason?: string;
  holdCount: number;
}

export async function evaluateRetentionHolds(request: HoldEvaluationRequest): Promise<HoldEvaluationResult> {
  const holds = await phase5Repository.retentionHold.findMany({
    where: {
      subjectType: request.subjectType,
      subjectReference: request.subjectReference,
      releasedAt: null, // Active hold
    },
    take: 5,
  }).catch(() => []);

  if (holds.length === 0) {
    // Also check wildcard or subject-level hold if subjectReference has user prefix
    if (request.subjectReference.includes(":")) {
      const parentRef = request.subjectReference.split(":")[0];
      const parentHolds = await phase5Repository.retentionHold.findMany({
        where: {
          subjectType: request.subjectType,
          subjectReference: parentRef,
          releasedAt: null,
        },
        take: 5,
      }).catch(() => []);

      if (parentHolds.length > 0) {
        return {
          hasHold: true,
          activeHoldReason: String(parentHolds[0].reasonCode),
          holdCount: parentHolds.length,
        };
      }
    }

    return { hasHold: false, holdCount: 0 };
  }

  return {
    hasHold: true,
    activeHoldReason: String(holds[0].reasonCode),
    holdCount: holds.length,
  };
}

export async function createRetentionHold(input: {
  subjectType: string;
  subjectReference: string;
  reasonCode: string;
  actorUserId?: string;
}) {
  return phase5Repository.retentionHold.upsert({
    where: {
      subjectType_subjectReference: {
        subjectType: input.subjectType,
        subjectReference: input.subjectReference,
      },
    },
    update: {
      reasonCode: input.reasonCode,
      releasedAt: null,
      releasedByUserId: null,
    },
    create: {
      subjectType: input.subjectType,
      subjectReference: input.subjectReference,
      reasonCode: input.reasonCode,
      createdByUserId: input.actorUserId ?? null,
    },
  });
}

export async function releaseRetentionHold(input: {
  subjectType: string;
  subjectReference: string;
  actorUserId: string;
}) {
  const hold = await phase5Repository.retentionHold.findFirst({
    where: {
      subjectType: input.subjectType,
      subjectReference: input.subjectReference,
      releasedAt: null,
    },
  });
  if (!hold) return null;

  return phase5Repository.retentionHold.update({
    where: { id: String(hold.id) },
    data: {
      releasedAt: new Date(),
      releasedByUserId: input.actorUserId,
    },
  });
}
