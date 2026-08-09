import { hasPermission } from "@/lib/auth/permissions";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { UserRole } from "@/types/db";
import { REPORT_DEFINITIONS, ReportingError, type ReportDefinitionContract, type ReportExportFormat } from "./contracts";

export interface ReportActor {
  id: string;
  role: UserRole | string;
}

const audienceRoles: Record<Exclude<ReportDefinitionContract["audience"], "ADMINISTRATOR" | "RECRUITMENT">, string> = {
  CUSTOMER: "CUSTOMER",
  STORE: "STORE",
  DRIVER: "DRIVER",
  PROMOTER: "PROMOTER",
  DEVELOPER: "ADMIN", // Developer reports are administrator-operated until an API-client principal is resolved.
};

function actorRole(actor: ReportActor): UserRole {
  return actor.role as UserRole;
}

async function requirePermission(actor: ReportActor, permissionKey: string): Promise<void> {
  const allowed = await hasPermission({ userId: actor.id, role: actorRole(actor), permissionKey });
  if (!allowed) throw new ReportingError("REPORT_PERMISSION_DENIED", 403, "You do not have permission for this report operation.");
}

export function getApprovedReportDefinition(key: string): ReportDefinitionContract {
  const definition = REPORT_DEFINITIONS[key];
  if (!definition) throw new ReportingError("REPORT_DEFINITION_NOT_FOUND", 404, "The requested report definition is unavailable.");
  return definition;
}

export async function authorizeReportDefinition(
  actor: ReportActor,
  definition: ReportDefinitionContract,
  operation: "READ" | "GENERATE" | "DOWNLOAD"
): Promise<void> {
  const admin = actor.role === UserRole.ADMIN || actor.role === UserRole.SUPER_ADMIN;
  if (definition.audience === "ADMINISTRATOR") {
    if (!admin) throw new ReportingError("REPORT_AUDIENCE_DENIED", 403, "This report is not available to this account.");
    await requirePermission(actor, definition.requiredPermission);
    return;
  }

  if (definition.audience === "RECRUITMENT" || audienceRoles[definition.audience] !== actor.role) {
    throw new ReportingError("REPORT_AUDIENCE_DENIED", 403, "This report is not available to this account.");
  }

  await requirePermission(actor, definition.requiredPermission);
  if (operation === "GENERATE") {
    const permission = actor.role === UserRole.STORE
      ? PERMISSIONS.STORE_REPORT_GENERATE
      : PERMISSIONS.REPORT_GENERATE_OWN;
    await requirePermission(actor, permission);
  }
  if (operation === "DOWNLOAD") await requirePermission(actor, PERMISSIONS.REPORT_DOWNLOAD_OWN);
}

export function normalizeReportRequest(args: {
  definition: ReportDefinitionContract;
  filters: unknown;
  outputFormat: unknown;
}): { filters: Record<string, string | number | boolean>; outputFormat: ReportExportFormat } {
  const { definition } = args;
  if (!args.filters || typeof args.filters !== "object" || Array.isArray(args.filters)) {
    throw new ReportingError("INVALID_REPORT_FILTERS", 422, "Report filters must be an object.");
  }

  const rawFilters = args.filters as Record<string, unknown>;
  const allowed = new Map(definition.allowedFilters.map((filter) => [filter.key, filter]));
  const normalized: Record<string, string | number | boolean> = {};
  const keys = Object.keys(rawFilters);
  if (keys.length > allowed.size) throw new ReportingError("INVALID_REPORT_FILTERS", 422, "Too many report filters.");

  for (const key of keys) {
    const policy = allowed.get(key);
    const value = rawFilters[key];
    if (!policy || value === undefined) throw new ReportingError("INVALID_REPORT_FILTER", 422, "An unsupported report filter was provided.");
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (!trimmed || trimmed.length > 120 || /[\r\n\0]/.test(trimmed)) throw new ReportingError("INVALID_REPORT_FILTER", 422, "A report filter is invalid.");
      if (policy.allowedValues && !policy.allowedValues.includes(trimmed)) throw new ReportingError("INVALID_REPORT_FILTER", 422, "A report filter value is invalid.");
      normalized[key] = trimmed;
      continue;
    }
    if (policy.type === "NUMBER" && typeof value === "number" && Number.isFinite(value)) {
      normalized[key] = value;
      continue;
    }
    if (policy.type === "BOOLEAN" && typeof value === "boolean") {
      normalized[key] = value;
      continue;
    }
    throw new ReportingError("INVALID_REPORT_FILTER", 422, "A report filter is invalid.");
  }

  if (typeof args.outputFormat !== "string" || !definition.allowedFormats.includes(args.outputFormat as ReportExportFormat) || args.outputFormat === "XLSX") {
    throw new ReportingError("REPORT_FORMAT_UNAVAILABLE", 422, "The requested report format is not available.");
  }
  return { filters: normalized, outputFormat: args.outputFormat as ReportExportFormat };
}
