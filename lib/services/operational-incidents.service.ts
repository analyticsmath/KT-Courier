import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { operationRequestHash, phase5Reference, phase5Repository, safeOperationalText } from "@/lib/operations/phase5-repository";
import { PrivateMediaService, type PrivateMediaActor } from "@/lib/private-media/private-media.service";
import { UserRole } from "@/types/db";

export class SecurityIncidentError extends Error {
  constructor(readonly code: string) { super(code); this.name = "SecurityIncidentError"; }
}

const transitions: Record<string, readonly string[]> = {
  OPEN: ["INVESTIGATING", "CLOSED"], INVESTIGATING: ["MITIGATING", "MONITORING", "CLOSED"],
  MITIGATING: ["MONITORING", "RESOLVED"], MONITORING: ["MITIGATING", "RESOLVED"], RESOLVED: ["CLOSED"], CLOSED: [],
};
const isTestMemory = () => process.env.NODE_ENV === "test" && process.env.PHASE5_REPOSITORY_USE_MEMORY === "true" && process.env.PHASE5_REPOSITORY_TEST_MEMORY === "true";
const isUnique = (error: unknown) => Boolean(error && typeof error === "object" && (error as { code?: string }).code === "P2002");
const hash = (operation: string, payload: Record<string, unknown>) => operationRequestHash({ operation, ...payload });

function assertOperation(record: { incidentId: string; operation: string; requestHash: string }, incidentId: string, operation: string, requestHash: string) {
  if (record.incidentId !== incidentId || record.operation !== operation || record.requestHash !== requestHash) throw new SecurityIncidentError("SECURITY_INCIDENT_IDEMPOTENCY_CONFLICT");
}

async function operationalReplay(operationId: string, incidentId: string, operation: string, requestHash: string) {
  const existing = await prisma.operationalIncidentOperation.findUnique({ where: { operationId } });
  if (!existing) return null;
  assertOperation(existing, incidentId, operation, requestHash);
  if (existing.state !== "SUCCEEDED") throw new SecurityIncidentError(existing.state === "FAILED" ? "SECURITY_INCIDENT_OPERATION_FAILED_RETRY_REQUIRED" : "SECURITY_INCIDENT_OPERATION_PENDING");
  return existing;
}

export async function listOperationalIncidents() {
  return isTestMemory() ? phase5Repository.operationalIncident.findMany({ orderBy: { openedAt: "desc" }, take: 100 }) : prisma.operationalIncident.findMany({ orderBy: { openedAt: "desc" }, take: 100 });
}

export async function getOperationalIncident(publicReference: string) {
  const incident = isTestMemory() ? await phase5Repository.operationalIncident.findUnique({ where: { publicReference } }) : await prisma.operationalIncident.findUnique({ where: { publicReference } });
  if (!incident) return null;
  // An unavailable audit read must propagate; an empty timeline is false evidence.
  const timeline = isTestMemory() ? await phase5Repository.operationalIncidentTimeline.findMany({ where: { incidentId: String(incident.id) }, orderBy: { createdAt: "asc" } }) : await prisma.operationalIncidentTimeline.findMany({ where: { incidentId: String(incident.id) }, orderBy: { createdAt: "asc" } });
  const publicIncident = { ...incident };
  delete (publicIncident as { id?: unknown }).id;
  return { ...publicIncident, timeline };
}

export async function getOperationalIncidentId(publicReference: string): Promise<string | null> {
  const incident = isTestMemory() ? await phase5Repository.operationalIncident.findUnique({ where: { publicReference } }) : await prisma.operationalIncident.findUnique({ where: { publicReference }, select: { id: true } });
  return incident ? String(incident.id) : null;
}

export async function createOperationalIncident(input: { actorUserId: string; severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"; category: string; safeSummary: string; affectedCapabilities?: string[]; detectionSource?: string; affectedDataClasses?: string[]; affectedUserId?: string; affectedResourceType?: string; affectedResourceRef?: string; operationId?: string }) {
  const operationId = input.operationId ?? phase5Reference("INCOP");
  const requestHash = hash("CREATE", { actorUserId: input.actorUserId, severity: input.severity, category: safeOperationalText(input.category, 80), safeSummary: safeOperationalText(input.safeSummary), affectedCapabilities: input.affectedCapabilities ?? [], detectionSource: input.detectionSource ?? null, affectedDataClasses: input.affectedDataClasses ?? [], affectedUserId: input.affectedUserId ?? null, affectedResourceType: input.affectedResourceType ?? null, affectedResourceRef: input.affectedResourceRef ?? null });
  const data = { publicReference: phase5Reference("INC"), severity: input.severity, category: safeOperationalText(input.category, 80), safeSummary: safeOperationalText(input.safeSummary), affectedCapabilities: input.affectedCapabilities?.slice(0, 20), detectionSource: input.detectionSource ? safeOperationalText(input.detectionSource, 80) : null, commanderUserId: input.actorUserId, affectedDataClasses: input.affectedDataClasses?.slice(0, 20) ?? Prisma.JsonNull, affectedUserId: input.affectedUserId ?? null, affectedResourceType: input.affectedResourceType ? safeOperationalText(input.affectedResourceType, 80) : null, affectedResourceRef: input.affectedResourceRef ? safeOperationalText(input.affectedResourceRef, 160) : null };
  if (isTestMemory()) {
    const replay = await phase5Repository.operationalIncidentOperation.findUnique({ where: { operationId } });
    if (replay) { if (String(replay.operation) !== "CREATE" || String(replay.requestHash) !== requestHash) throw new SecurityIncidentError("SECURITY_INCIDENT_IDEMPOTENCY_CONFLICT"); return phase5Repository.operationalIncident.findUnique({ where: { id: String(replay.incidentId) } }); }
    const incident = await phase5Repository.operationalIncident.create({ data });
    await phase5Repository.operationalIncidentOperation.create({ data: { incidentId: String(incident.id), operationId, operation: "CREATE", requestHash, state: "SUCCEEDED" } });
    await phase5Repository.operationalIncidentTimeline.create({ data: { incidentId: String(incident.id), eventType: "INCIDENT_OPENED", safeNote: "Operational incident opened.", actorUserId: input.actorUserId, operationId: `${operationId}:AUDIT` } });
    return incident;
  }
  const existing = await prisma.operationalIncidentOperation.findUnique({ where: { operationId }, include: { incident: true } });
  if (existing) { assertOperation(existing, existing.incidentId, "CREATE", requestHash); if (existing.state !== "SUCCEEDED") throw new SecurityIncidentError("SECURITY_INCIDENT_OPERATION_PENDING"); return existing.incident; }
  try {
    return await prisma.$transaction(async (tx) => {
      const incident = await tx.operationalIncident.create({ data });
      await tx.operationalIncidentOperation.create({ data: { incidentId: incident.id, operationId, operation: "CREATE", requestHash, state: "SUCCEEDED" } });
      await tx.operationalIncidentTimeline.create({ data: { incidentId: incident.id, eventType: "INCIDENT_OPENED", safeNote: "Operational incident opened.", actorUserId: input.actorUserId, operationId: `${operationId}:AUDIT` } });
      return incident;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    if (!isUnique(error)) throw error;
    const winner = await prisma.operationalIncidentOperation.findUnique({ where: { operationId }, include: { incident: true } });
    if (!winner) throw error;
    assertOperation(winner, winner.incidentId, "CREATE", requestHash);
    return winner.incident;
  }
}

export async function recordIncidentActivity(input: { actorUserId: string; publicReference: string; eventType: string; safeNote: string; operationId: string }) {
  const incident = await prisma.operationalIncident.findUnique({ where: { publicReference: input.publicReference } });
  if (!incident) throw new SecurityIncidentError("SECURITY_INCIDENT_NOT_FOUND");
  const requestHash = hash("ACTIVITY", { actorUserId: input.actorUserId, eventType: safeOperationalText(input.eventType, 60), safeNote: safeOperationalText(input.safeNote, 512) });
  const replay = await operationalReplay(input.operationId, incident.id, "ACTIVITY", requestHash);
  if (replay) return prisma.operationalIncidentTimeline.findUniqueOrThrow({ where: { operationId: `${input.operationId}:AUDIT` } });
  try {
    return await prisma.$transaction(async (tx) => {
      await tx.operationalIncidentOperation.create({ data: { incidentId: incident.id, operationId: input.operationId, operation: "ACTIVITY", requestHash, state: "PENDING" } });
      const timeline = await tx.operationalIncidentTimeline.create({ data: { incidentId: incident.id, eventType: safeOperationalText(input.eventType, 60), safeNote: safeOperationalText(input.safeNote, 512), actorUserId: input.actorUserId, operationId: `${input.operationId}:AUDIT` } });
      await tx.operationalIncidentOperation.update({ where: { operationId: input.operationId }, data: { state: "SUCCEEDED", result: { timelineId: timeline.id } } });
      return timeline;
    });
  } catch (error) {
    if (!isUnique(error)) throw error;
    const winner = await operationalReplay(input.operationId, incident.id, "ACTIVITY", requestHash);
    if (!winner) throw error;
    return prisma.operationalIncidentTimeline.findUniqueOrThrow({ where: { operationId: `${input.operationId}:AUDIT` } });
  }
}

export async function attachIncidentEvidence(input: { actorUserId: string; actorRole?: UserRole; publicReference: string; privateMediaObjectId?: string; evidenceType: string; safeReference?: string; operationId: string }) {
  const incident = await prisma.operationalIncident.findUnique({ where: { publicReference: input.publicReference } });
  if (!incident) throw new SecurityIncidentError("SECURITY_INCIDENT_NOT_FOUND");
  const requestHash = hash("EVIDENCE", { actorUserId: input.actorUserId, privateMediaObjectId: input.privateMediaObjectId ?? null, evidenceType: safeOperationalText(input.evidenceType, 80), safeReference: input.safeReference ? safeOperationalText(input.safeReference, 160) : null });
  const replay = await operationalReplay(input.operationId, incident.id, "EVIDENCE", requestHash);
  if (replay) return prisma.operationalIncidentEvidence.findUniqueOrThrow({ where: { operationId: input.operationId } });
  if (input.privateMediaObjectId) {
    const role = input.actorRole ?? (await prisma.user.findUnique({ where: { id: input.actorUserId }, select: { role: true } }))?.role;
    if (!role) throw new SecurityIncidentError("SECURITY_INCIDENT_FORBIDDEN");
    await new PrivateMediaService().assertIncidentEvidenceEntitlement({ actor: { userId: input.actorUserId, role } satisfies PrivateMediaActor, privateMediaObjectId: input.privateMediaObjectId, incidentId: incident.id });
  }
  try {
    return await prisma.$transaction(async (tx) => {
      await tx.operationalIncidentOperation.create({ data: { incidentId: incident.id, operationId: input.operationId, operation: "EVIDENCE", requestHash, state: "PENDING" } });
      const evidence = await tx.operationalIncidentEvidence.create({ data: { incidentId: incident.id, privateMediaObjectId: input.privateMediaObjectId ?? null, evidenceType: safeOperationalText(input.evidenceType, 80), safeReference: input.safeReference ? safeOperationalText(input.safeReference, 160) : null, createdByUserId: input.actorUserId, operationId: input.operationId } });
      await tx.operationalIncidentOperation.update({ where: { operationId: input.operationId }, data: { state: "SUCCEEDED", result: { evidenceId: evidence.id } } });
      return evidence;
    });
  } catch (error) {
    if (!isUnique(error)) throw error;
    const winner = await operationalReplay(input.operationId, incident.id, "EVIDENCE", requestHash);
    if (!winner) throw error;
    return prisma.operationalIncidentEvidence.findUniqueOrThrow({ where: { operationId: input.operationId } });
  }
}

export async function recordIncidentNotificationDecision(input: { actorUserId: string; publicReference: string; decision: "NOT_REQUIRED" | "PENDING_LEGAL_REVIEW" | "USER_NOTIFICATION" | "REGULATOR_NOTIFICATION" | "PROVIDER_ESCALATION"; reasonCode: string; operationId: string }) {
  const incident = await prisma.operationalIncident.findUnique({ where: { publicReference: input.publicReference } });
  if (!incident) throw new SecurityIncidentError("SECURITY_INCIDENT_NOT_FOUND");
  const requestHash = hash("NOTIFICATION", { actorUserId: input.actorUserId, decision: input.decision, reasonCode: safeOperationalText(input.reasonCode, 80) });
  const replay = await operationalReplay(input.operationId, incident.id, "NOTIFICATION", requestHash);
  if (replay) return incident;
  try {
    return await prisma.$transaction(async (tx) => {
      await tx.operationalIncidentOperation.create({ data: { incidentId: incident.id, operationId: input.operationId, operation: "NOTIFICATION", requestHash, state: "PENDING" } });
      const updated = await tx.operationalIncident.update({ where: { id: incident.id }, data: { notificationDecision: { decision: input.decision, reasonCode: safeOperationalText(input.reasonCode, 80), actorUserId: input.actorUserId, decidedAt: new Date().toISOString(), legalReviewStatus: "LEGAL_REVIEW_REQUIRED" } } });
      await tx.operationalIncidentTimeline.create({ data: { incidentId: incident.id, eventType: "NOTIFICATION_DECISION", safeNote: input.decision, actorUserId: input.actorUserId, operationId: `${input.operationId}:AUDIT` } });
      await tx.operationalIncidentOperation.update({ where: { operationId: input.operationId }, data: { state: "SUCCEEDED" } });
      return updated;
    });
  } catch (error) {
    if (!isUnique(error)) throw error;
    const winner = await operationalReplay(input.operationId, incident.id, "NOTIFICATION", requestHash);
    if (!winner) throw error;
    return prisma.operationalIncident.findUniqueOrThrow({ where: { id: incident.id } });
  }
}

export async function transitionOperationalIncident(input: { actorUserId: string; publicReference: string; nextStatus: "INVESTIGATING" | "MITIGATING" | "MONITORING" | "RESOLVED" | "CLOSED"; reasonCode: string; note?: string; operationId: string }) {
  if (isTestMemory()) {
    const incident = await phase5Repository.operationalIncident.findUnique({ where: { publicReference: input.publicReference } });
    if (!incident) throw new SecurityIncidentError("SECURITY_INCIDENT_NOT_FOUND");
    if (!transitions[String(incident.status)]?.includes(input.nextStatus)) throw new SecurityIncidentError("SECURITY_INCIDENT_INVALID_TRANSITION");
    const updated = await phase5Repository.operationalIncident.update({ where: { id: String(incident.id) }, data: { status: input.nextStatus } });
    await phase5Repository.operationalIncidentTimeline.create({ data: { incidentId: String(incident.id), eventType: `STATUS_${input.nextStatus}`, safeNote: safeOperationalText(input.note ?? input.reasonCode), actorUserId: input.actorUserId, operationId: input.operationId } });
    return updated;
  }
  const incident = await prisma.operationalIncident.findUnique({ where: { publicReference: input.publicReference } });
  if (!incident) throw new SecurityIncidentError("SECURITY_INCIDENT_NOT_FOUND");
  const requestHash = hash("TRANSITION", { actorUserId: input.actorUserId, nextStatus: input.nextStatus, reasonCode: safeOperationalText(input.reasonCode, 80), note: input.note ? safeOperationalText(input.note) : null });
  const replay = await operationalReplay(input.operationId, incident.id, "TRANSITION", requestHash);
  if (replay) return prisma.operationalIncident.findUniqueOrThrow({ where: { id: incident.id } });
  if (!transitions[incident.status]?.includes(input.nextStatus)) throw new SecurityIncidentError("SECURITY_INCIDENT_INVALID_TRANSITION");
  try {
    return await prisma.$transaction(async (tx) => {
      await tx.operationalIncidentOperation.create({ data: { incidentId: incident.id, operationId: input.operationId, operation: "TRANSITION", requestHash, state: "PENDING" } });
      const updated = await tx.operationalIncident.update({ where: { id: incident.id }, data: { status: input.nextStatus, ...(input.nextStatus === "RESOLVED" ? { resolvedAt: new Date(), resolutionSummary: safeOperationalText(input.note ?? input.reasonCode) } : {}), ...(input.nextStatus === "CLOSED" ? { closedAt: new Date() } : {}), ...(input.nextStatus === "MITIGATING" ? { mitigationSummary: safeOperationalText(input.note ?? input.reasonCode) } : {}) } });
      await tx.operationalIncidentTimeline.create({ data: { incidentId: incident.id, eventType: `STATUS_${input.nextStatus}`, safeNote: safeOperationalText(input.note ?? input.reasonCode), actorUserId: input.actorUserId, operationId: `${input.operationId}:AUDIT` } });
      await tx.operationalIncidentOperation.update({ where: { operationId: input.operationId }, data: { state: "SUCCEEDED" } });
      return updated;
    });
  } catch (error) {
    if (!isUnique(error)) throw error;
    const winner = await operationalReplay(input.operationId, incident.id, "TRANSITION", requestHash);
    if (!winner) throw error;
    return prisma.operationalIncident.findUniqueOrThrow({ where: { id: incident.id } });
  }
}

export async function containSecurityIncident(input: { actorUserId: string; publicReference: string; operationId: string; affectedUserId?: string; createPreservationHold?: boolean }) {
  const incident = await prisma.operationalIncident.findUnique({ where: { publicReference: input.publicReference } });
  if (!incident) throw new SecurityIncidentError("SECURITY_INCIDENT_NOT_FOUND");
  const userId = input.affectedUserId ?? incident.affectedUserId;
  const requestHash = hash("CONTAINMENT", { actorUserId: input.actorUserId, affectedUserId: userId ?? null, createPreservationHold: Boolean(input.createPreservationHold) });
  const replay = await operationalReplay(input.operationId, incident.id, "CONTAINMENT", requestHash);
  if (replay) return prisma.operationalIncident.findUniqueOrThrow({ where: { id: incident.id } });
  try {
    return await prisma.$transaction(async (tx) => {
      await tx.operationalIncidentOperation.create({ data: { incidentId: incident.id, operationId: input.operationId, operation: "CONTAINMENT", requestHash, state: "PENDING" } });
      if (userId) {
        await tx.session.updateMany({ where: { userId, revokedAt: null, expiresAt: { gt: new Date() } }, data: { revokedAt: new Date(), revokedReason: "SECURITY_INCIDENT", revokedByUserId: input.actorUserId } });
        await tx.securityEvent.create({ data: { type: "INCIDENT_SESSION_REVOKED", severity: "HIGH", userId, actorUserId: input.actorUserId, message: "Sessions revoked under a security incident.", metadata: { incidentReference: incident.publicReference, operationId: input.operationId } } });
        if (input.createPreservationHold) await tx.retentionHold.upsert({ where: { subjectType_subjectReference: { subjectType: "User", subjectReference: userId } }, update: { reasonCode: `SECURITY_INCIDENT:${incident.publicReference}`, releasedAt: null, releasedByUserId: null }, create: { subjectType: "User", subjectReference: userId, reasonCode: `SECURITY_INCIDENT:${incident.publicReference}`, createdByUserId: input.actorUserId } });
      }
      if (!["OPEN", "INVESTIGATING", "MITIGATING"].includes(incident.status)) throw new SecurityIncidentError("SECURITY_INCIDENT_INVALID_TRANSITION");
      if (incident.status === "OPEN") await tx.operationalIncidentTimeline.create({ data: { incidentId: incident.id, eventType: "STATUS_INVESTIGATING", safeNote: "CONTAINMENT_TRIAGE", actorUserId: input.actorUserId, operationId: `${input.operationId}:TRIAGE` } });
      const updated = incident.status === "MITIGATING" ? incident : await tx.operationalIncident.update({ where: { id: incident.id }, data: { status: "MITIGATING", mitigationSummary: userId ? "SESSIONS_REVOKED" : "NO_ACCOUNT_ACTION" } });
      await tx.operationalIncidentTimeline.create({ data: { incidentId: incident.id, eventType: "CONTAINMENT", safeNote: userId ? "SESSIONS_REVOKED" : "NO_ACCOUNT_ACTION", actorUserId: input.actorUserId, operationId: `${input.operationId}:AUDIT` } });
      await tx.operationalIncidentOperation.update({ where: { operationId: input.operationId }, data: { state: "SUCCEEDED", result: { status: "MITIGATING" } } });
      return updated;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    if (!isUnique(error)) throw error;
    const winner = await operationalReplay(input.operationId, incident.id, "CONTAINMENT", requestHash);
    if (!winner) throw error;
    return prisma.operationalIncident.findUniqueOrThrow({ where: { id: incident.id } });
  }
}
