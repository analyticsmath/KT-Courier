import { IncidentManager, type OperationalIncidentItem } from "@/components/admin/IncidentManager";
import { ProtectedPageFrame, ProtectedPageHeader } from "@/components/protected-v2";
import { requireAdminPagePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { listOperationalIncidents } from "@/lib/services/operational-incidents.service";

export default async function IncidentsPage() {
  await requireAdminPagePermission(PERMISSIONS.INCIDENTS_READ);
  const incidents = await listOperationalIncidents().catch(() => []);
  const initialIncidents: OperationalIncidentItem[] = incidents.flatMap((incident) => {
    const severity = stringOption(incident.severity, ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const);
    const id = stringValue(incident.id);
    const publicReference = stringValue(incident.publicReference);
    const category = stringValue(incident.category);
    const safeSummary = stringValue(incident.safeSummary);
    if (!severity || !id || !publicReference || !category || !safeSummary) return [];
    return [{
      id,
      publicReference,
      severity,
      category,
      status: stringValue(incident.status) ?? "OPEN",
      safeSummary,
      affectedCapabilities: stringArray(incident.affectedCapabilities),
      detectionSource: stringValue(incident.detectionSource),
      commanderUserId: stringValue(incident.commanderUserId),
      mitigationSummary: stringValue(incident.mitigationSummary),
      resolutionSummary: stringValue(incident.resolutionSummary),
      openedAt: dateValue(incident.openedAt),
      resolvedAt: optionalDateValue(incident.resolvedAt),
      closedAt: optionalDateValue(incident.closedAt),
    }];
  });

  return (
    <ProtectedPageFrame>
      <ProtectedPageHeader
        eyebrow="Operations"
        title="Operational Incident Operations"
        description="Declare operational incidents, assign commanders, record state transitions, and maintain append-only timelines."
      />

      <IncidentManager initialIncidents={initialIncidents} />
    </ProtectedPageFrame>
  );
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function stringOption<T extends string>(value: unknown, options: readonly T[]): T | undefined {
  return typeof value === "string" ? options.find((option) => option === value) : undefined;
}

function stringArray(value: unknown): string[] | null {
  return Array.isArray(value) && value.every((item) => typeof item === "string") ? value : null;
}

function dateValue(value: unknown): string {
  return value instanceof Date ? value.toISOString() : typeof value === "string" ? value : new Date(0).toISOString();
}

function optionalDateValue(value: unknown): string | null {
  return value instanceof Date ? value.toISOString() : typeof value === "string" ? value : null;
}
