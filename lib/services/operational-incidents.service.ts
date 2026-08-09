import { recordAdminActivity } from "./admin-activity.service";
import { phase5Reference, phase5Repository, safeOperationalText } from "@/lib/operations/phase5-repository";

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
  const incident = await phase5Repository.operationalIncident.findUnique({ where: { publicReference } });
  if (!incident) return null;

  const timeline = await phase5Repository.operationalIncidentTimeline.findMany({
    where: { incidentId: String(incident.id) },
    orderBy: { createdAt: "asc" },
  }).catch(() => []);

  return {
    ...incident,
    timeline,
  };
}

export async function createOperationalIncident(input: {
  actorUserId: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  category: string;
  safeSummary: string;
  affectedCapabilities?: string[];
  detectionSource?: string;
}) {
  const incident = await phase5Repository.operationalIncident.create({
    data: {
      publicReference: phase5Reference("INC"),
      severity: input.severity,
      category: safeOperationalText(input.category, 80),
      safeSummary: safeOperationalText(input.safeSummary),
      affectedCapabilities: input.affectedCapabilities?.slice(0, 20),
      detectionSource: input.detectionSource ? safeOperationalText(input.detectionSource, 80) : null,
      commanderUserId: input.actorUserId,
    },
  });

  await phase5Repository.operationalIncidentTimeline.create({
    data: {
      incidentId: String(incident.id),
      eventType: "INCIDENT_OPENED",
      safeNote: "Operational incident opened.",
      actorUserId: input.actorUserId,
      operationId: phase5Reference("INCOP"),
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
