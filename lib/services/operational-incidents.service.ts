import { recordAdminActivity } from "./admin-activity.service";
import { phase5Reference, phase5Repository, safeOperationalText } from "@/lib/operations/phase5-repository";
import { createRetentionHold } from "@/lib/retention/hold-evaluator";
import { recordSecurityEvent } from "@/lib/services/security-events.service";
import { prisma } from "@/lib/db/prisma";
import { revokeAllUserSessions } from "@/lib/auth/session";

export class SecurityIncidentError extends Error { constructor(readonly code: string) { super(code); this.name = "SecurityIncidentError"; } }

type OperationalIncidentAuthority = Record<string, unknown> & { id: string };

function readOperationalIncidentAuthority(record: Record<string, unknown>): OperationalIncidentAuthority {
  if (typeof record.id !== "string" || record.id.length === 0) {
    throw new SecurityIncidentError("SECURITY_INCIDENT_INVALID_PROJECTION");
  }

  return { ...record, id: record.id };
}

function withoutOperationalIncidentId(record: OperationalIncidentAuthority): Record<string, unknown> {
  const { id: _id, ...publicRecord } = record;
  return publicRecord;
}

const transitions: Record<string, readonly string[]> = {
  OPEN: ["INVESTIGATING", "CLOSED"],
  INVESTIGATING: ["MITIGATING", "MONITORING", "CLOSED"],
  MITIGATING: ["MONITORING", "RESOLVED"],
  MONITORING: ["MITIGATING", "RESOLVED"],
  RESOLVED: ["CLOSED"],
  CLOSED: [],
};

export async function listOperationalIncidents() {
  return phase5Repository.operationalIncident.findMany({ orderBy: { openedAt: "desc" }, take: 100 });
}

export async function getOperationalIncident(publicReference: string) {
  const rawIncident = await phase5Repository.operationalIncident.findUnique({ where: { publicReference } });
  if (!rawIncident) return null;
  const incident = readOperationalIncidentAuthority(rawIncident);

  const timeline = await phase5Repository.operationalIncidentTimeline.findMany({
    where: { incidentId: String(incident.id) },
    orderBy: { createdAt: "asc" },
  }).catch(() => []);

  return {
    ...withoutOperationalIncidentId(incident),
    timeline,
  };
}

/**
 * Resolves the internal incident identifier for server-side operations while
 * keeping that identifier out of the public incident detail projection.
 */
export async function getOperationalIncidentId(publicReference: string): Promise<string | null> {
  const incident = await phase5Repository.operationalIncident.findUnique({ where: { publicReference } });
  return incident ? readOperationalIncidentAuthority(incident).id : null;
}

export async function createOperationalIncident(input: {
  actorUserId: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  category: string;
  safeSummary: string;
  affectedCapabilities?: string[];
  detectionSource?: string;
  affectedDataClasses?: string[];
  affectedUserId?: string;
  affectedResourceType?: string;
  affectedResourceRef?: string;
  operationId?: string;
}) {
  if (input.operationId) { const replay = await phase5Repository.operationalIncidentTimeline.findUnique({ where: { operationId: input.operationId } }); if (replay) return phase5Repository.operationalIncident.findUnique({ where: { id: String(replay.incidentId) } }); }
  const incident = await phase5Repository.operationalIncident.create({
    data: {
      publicReference: phase5Reference("INC"),
      severity: input.severity,
      category: safeOperationalText(input.category, 80),
      safeSummary: safeOperationalText(input.safeSummary),
      affectedCapabilities: input.affectedCapabilities?.slice(0, 20),
      detectionSource: input.detectionSource ? safeOperationalText(input.detectionSource, 80) : null,
      commanderUserId: input.actorUserId,
      affectedDataClasses: input.affectedDataClasses?.slice(0, 20) ?? null,
      affectedUserId: input.affectedUserId ?? null,
      affectedResourceType: input.affectedResourceType ? safeOperationalText(input.affectedResourceType, 80) : null,
      affectedResourceRef: input.affectedResourceRef ? safeOperationalText(input.affectedResourceRef, 160) : null,
    },
  });

  await phase5Repository.operationalIncidentTimeline.create({
    data: {
      incidentId: String(incident.id),
      eventType: "INCIDENT_OPENED",
      safeNote: "Operational incident opened.",
      actorUserId: input.actorUserId,
      operationId: input.operationId ?? phase5Reference("INCOP"),
    },
  });

  await recordAdminActivity({
    actorUserId: input.actorUserId,
    action: "CREATE",
    entityType: "OperationalIncident",
    entityId: String(incident.id),
    message: "Opened operational incident",
    metadata: { reference: String(incident.publicReference), severity: input.severity },
  });

  return incident;
}

export async function recordIncidentActivity(input: { actorUserId: string; publicReference: string; eventType: string; safeNote: string; operationId: string }) {
  const incident = await phase5Repository.operationalIncident.findUnique({ where: { publicReference: input.publicReference } }); if (!incident) throw new SecurityIncidentError("SECURITY_INCIDENT_NOT_FOUND");
  const replay = await phase5Repository.operationalIncidentTimeline.findUnique({ where: { operationId: input.operationId } }); if (replay) return replay;
  return phase5Repository.operationalIncidentTimeline.create({ data: { incidentId: String(incident.id), eventType: safeOperationalText(input.eventType, 60), safeNote: safeOperationalText(input.safeNote, 512), actorUserId: input.actorUserId, operationId: input.operationId } });
}

export async function attachIncidentEvidence(input: { actorUserId: string; publicReference: string; privateMediaObjectId?: string; evidenceType: string; safeReference?: string; operationId: string }) {
  const incident = await phase5Repository.operationalIncident.findUnique({ where: { publicReference: input.publicReference } }); if (!incident) throw new SecurityIncidentError("SECURITY_INCIDENT_NOT_FOUND");
  if (input.privateMediaObjectId) { const media = await (prisma as any).privateMediaObject.findUnique({ where: { id: input.privateMediaObjectId }, select: { id: true } }); if (!media) throw new SecurityIncidentError("SECURITY_INCIDENT_EVIDENCE_NOT_FOUND"); }
  const replay = await phase5Repository.operationalIncidentEvidence.findUnique({ where: { operationId: input.operationId } }); if (replay) return replay;
  return phase5Repository.operationalIncidentEvidence.create({ data: { incidentId: String(incident.id), privateMediaObjectId: input.privateMediaObjectId ?? null, evidenceType: safeOperationalText(input.evidenceType, 80), safeReference: input.safeReference ? safeOperationalText(input.safeReference, 160) : null, createdByUserId: input.actorUserId, operationId: input.operationId } });
}

export async function recordIncidentNotificationDecision(input: { actorUserId: string; publicReference: string; decision: "NOT_REQUIRED" | "PENDING_LEGAL_REVIEW" | "USER_NOTIFICATION" | "REGULATOR_NOTIFICATION" | "PROVIDER_ESCALATION"; reasonCode: string; operationId: string }) {
  const incident = await phase5Repository.operationalIncident.findUnique({ where: { publicReference: input.publicReference } }); if (!incident) throw new SecurityIncidentError("SECURITY_INCIDENT_NOT_FOUND");
  const replay = await phase5Repository.operationalIncidentTimeline.findUnique({ where: { operationId: input.operationId } }); if (replay) return incident;
  const updated = await phase5Repository.operationalIncident.update({ where: { id: String(incident.id) }, data: { notificationDecision: { decision: input.decision, reasonCode: safeOperationalText(input.reasonCode, 80), actorUserId: input.actorUserId, decidedAt: new Date().toISOString(), legalReviewStatus: "LEGAL_REVIEW_REQUIRED" } } });
  await recordIncidentActivity({ actorUserId: input.actorUserId, publicReference: input.publicReference, eventType: "NOTIFICATION_DECISION", safeNote: input.decision, operationId: input.operationId }); return updated;
}

export async function containSecurityIncident(input: { actorUserId: string; publicReference: string; operationId: string; affectedUserId?: string; createPreservationHold?: boolean }) {
  const incident = await phase5Repository.operationalIncident.findUnique({ where: { publicReference: input.publicReference } }); if (!incident) throw new SecurityIncidentError("SECURITY_INCIDENT_NOT_FOUND");
  const replay = await phase5Repository.operationalIncidentTimeline.findUnique({ where: { operationId: input.operationId } }); if (replay) return incident;
  const userId = input.affectedUserId ?? (incident.affectedUserId as string | null); let safeguard = "NO_ACCOUNT_ACTION";
  try { if (userId) { await revokeAllUserSessions({ userId, reason: "SECURITY_INCIDENT", revokedByUserId: input.actorUserId }); await recordSecurityEvent({ type: "INCIDENT_SESSION_REVOKED", severity: "HIGH", userId, actorUserId: input.actorUserId, message: "Sessions revoked under a security incident." }); safeguard = "SESSIONS_REVOKED"; } if (input.createPreservationHold && userId) await createRetentionHold({ subjectType: "User", subjectReference: userId, reasonCode: `SECURITY_INCIDENT:${incident.publicReference}`, actorUserId: input.actorUserId }); }
  catch { await recordIncidentActivity({ actorUserId: input.actorUserId, publicReference: input.publicReference, eventType: "CONTAINMENT_FAILED", safeNote: "SAFEGUARD_ACTION_FAILED", operationId: input.operationId }); throw new SecurityIncidentError("SECURITY_INCIDENT_CONTAINMENT_FAILED"); }
  await recordIncidentActivity({ actorUserId: input.actorUserId, publicReference: input.publicReference, eventType: "CONTAINMENT", safeNote: safeguard, operationId: input.operationId });
  if (String(incident.status) === "OPEN") await transitionOperationalIncident({ actorUserId: input.actorUserId, publicReference: input.publicReference, nextStatus: "INVESTIGATING", reasonCode: "CONTAINMENT_TRIAGE", operationId: `${input.operationId}:TRIAGE` });
  return transitionOperationalIncident({ actorUserId: input.actorUserId, publicReference: input.publicReference, nextStatus: "MITIGATING", reasonCode: safeguard, operationId: `${input.operationId}:STATUS` });
}

export async function transitionOperationalIncident(input: {
  actorUserId: string;
  publicReference: string;
  nextStatus: "INVESTIGATING" | "MITIGATING" | "MONITORING" | "RESOLVED" | "CLOSED";
  reasonCode: string;
  note?: string;
  operationId: string;
}) {
  const incident = await phase5Repository.operationalIncident.findUnique({ where: { publicReference: input.publicReference } });
  if (!incident) throw new Error("Operational incident not found.");

  const currentStatus = String(incident.status);
  if (!transitions[currentStatus]?.includes(input.nextStatus)) {
    throw new Error("Incident transition is not permitted from its current state.");
  }

  const existingOperation = await phase5Repository.operationalIncidentTimeline.findUnique({ where: { operationId: input.operationId } });
  if (existingOperation) return incident;

  const updated = await phase5Repository.operationalIncident.update({
    where: { id: incident.id },
    data: {
      status: input.nextStatus,
      ...(input.nextStatus === "RESOLVED" ? { resolvedAt: new Date(), resolutionSummary: safeOperationalText(input.note ?? input.reasonCode) } : {}),
      ...(input.nextStatus === "CLOSED" ? { closedAt: new Date() } : {}),
      ...(input.nextStatus === "MITIGATING" ? { mitigationSummary: safeOperationalText(input.note ?? input.reasonCode) } : {}),
    },
  });

  await phase5Repository.operationalIncidentTimeline.create({
    data: {
      incidentId: String(incident.id),
      eventType: `STATUS_${input.nextStatus}`,
      safeNote: safeOperationalText(input.note ?? input.reasonCode),
      actorUserId: input.actorUserId,
      operationId: input.operationId,
    },
  });

  await recordAdminActivity({
    actorUserId: input.actorUserId,
    action: "STATUS_CHANGE",
    entityType: "OperationalIncident",
    entityId: String(incident.id),
    message: "Changed operational incident status",
    metadata: { reasonCode: safeOperationalText(input.reasonCode, 80), operationId: input.operationId },
  });

  return updated;
}
