import { recordAdminActivity } from "./admin-activity.service";
import { phase5Reference, phase5Repository, safeOperationalText } from "@/lib/operations/phase5-repository";
import { evaluateRetentionHolds } from "@/lib/retention/hold-evaluator";

const privacyTransitions: Record<string, readonly string[]> = {
  RECEIVED: ["IDENTITY_VERIFICATION_REQUIRED", "REJECTED_WITH_REASON", "CANCELLED"],
  IDENTITY_VERIFICATION_REQUIRED: ["VERIFIED", "REJECTED_WITH_REASON", "CANCELLED"],
  VERIFIED: ["IN_REVIEW", "CANCELLED"],
  IN_REVIEW: ["FULFILMENT_IN_PROGRESS", "REJECTED_WITH_REASON"],
  FULFILMENT_IN_PROGRESS: ["COMPLETED", "REJECTED_WITH_REASON"],
  COMPLETED: [],
  REJECTED_WITH_REASON: [],
  CANCELLED: [],
};

export async function listPrivacyRequests() {
  return phase5Repository.privacyRequest.findMany({ orderBy: { createdAt: "desc" }, take: 100 });
}

export async function getPrivacyRequest(publicReference: string) {
  const request = await phase5Repository.privacyRequest.findUnique({ where: { publicReference } });
  if (!request) return null;

  const events = await phase5Repository.privacyRequestEvent.findMany({
    where: { privacyRequestId: String(request.id) },
    orderBy: { createdAt: "asc" },
  }).catch(() => []);

  let holdSummary = null;
  if (request.requesterUserId) {
    const holdEval = await evaluateRetentionHolds({
      subjectType: "User",
      subjectReference: String(request.requesterUserId),
    });
    holdSummary = holdEval;
  }

  return {
    ...request,
    events,
    holdEvaluationSummary: holdSummary,
  };
}

export async function createPrivacyRequest(input: {
  requesterUserId?: string;
  requestType: "ACCESS" | "DELETION" | "CORRECTION";
  scope: string[];
  operationId: string;
}) {
  const existing = await phase5Repository.privacyRequestEvent.findUnique({ where: { operationId: input.operationId } });
  if (existing) return existing;

  return phase5Repository.privacyRequest.create({
    data: {
      publicReference: phase5Reference("PRIV"),
      requesterUserId: input.requesterUserId ?? null,
      requestType: input.requestType,
      scope: input.scope.slice(0, 20),
      operationId: input.operationId,
      status: "RECEIVED",
      identityVerificationStatus: "REQUIRED",
    },
  });
}

export async function transitionPrivacyRequest(input: {
  actorUserId: string;
  publicReference: string;
  nextStatus: keyof typeof privacyTransitions;
  reasonCode: string;
  identityVerified?: boolean;
  operationId: string;
}) {
  const request = await phase5Repository.privacyRequest.findUnique({ where: { publicReference: input.publicReference } });
  if (!request) throw new Error("Privacy request not found.");

  if (!privacyTransitions[String(request.status)]?.includes(input.nextStatus)) {
    throw new Error("Privacy request transition is not permitted.");
  }

  if (
    (input.nextStatus === "VERIFIED" ||
      input.nextStatus === "IN_REVIEW" ||
      input.nextStatus === "FULFILMENT_IN_PROGRESS" ||
      input.nextStatus === "COMPLETED") &&
    request.identityVerificationStatus !== "VERIFIED" &&
    !input.identityVerified
  ) {
    throw new Error("Identity verification is required before privacy fulfilment.");
  }

  // Evaluate holds before completing deletion request
  if (input.nextStatus === "COMPLETED" && request.requestType === "DELETION" && request.requesterUserId) {
    const holdEval = await evaluateRetentionHolds({
      subjectType: "User",
      subjectReference: String(request.requesterUserId),
    });
    if (holdEval.hasHold) {
      throw new Error(`Active retention hold '${holdEval.activeHoldReason}' prevents subject deletion fulfilment.`);
    }
  }

  const existing = await phase5Repository.privacyRequestEvent.findUnique({ where: { operationId: input.operationId } });
  if (existing) return request;

  const updated = await phase5Repository.privacyRequest.update({
    where: { id: request.id },
    data: {
      status: input.nextStatus,
      ...(input.identityVerified ? { identityVerificationStatus: "VERIFIED" } : {}),
      ...(input.nextStatus === "COMPLETED"
        ? { completedAt: new Date(), safeOutcome: safeOperationalText(input.reasonCode, 160) }
        : {}),
      operationId: String(request.operationId),
    },
  });

  await phase5Repository.privacyRequestEvent.create({
    data: {
      privacyRequestId: String(request.id),
      operationId: input.operationId,
      eventType: input.nextStatus,
      safeReasonCode: safeOperationalText(input.reasonCode, 80),
      actorUserId: input.actorUserId,
    },
  });

  await recordAdminActivity({
    actorUserId: input.actorUserId,
    action: "STATUS_CHANGE",
    entityType: "PrivacyRequest",
    entityId: String(request.id),
    message: "Updated privacy request lifecycle",
    metadata: {
      operationId: input.operationId,
      nextStatus: input.nextStatus,
      reasonCode: safeOperationalText(input.reasonCode, 80),
    },
  });

  return updated;
}
