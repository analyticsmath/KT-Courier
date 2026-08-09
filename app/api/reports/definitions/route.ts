import { getCurrentUser } from "@/lib/auth/current-user";
import { ok, unauthorized } from "@/lib/api/response";
import { REPORT_DEFINITIONS } from "@/lib/reporting/contracts";
import { authorizeReportDefinition } from "@/lib/reporting/authorization";

export async function GET() {
  const session = await getCurrentUser();
  if (!session) return unauthorized();

  const candidates = Object.values(REPORT_DEFINITIONS);
  const authorized = await Promise.all(candidates.map(async (definition) => {
    try { await authorizeReportDefinition(session, definition, "READ"); return definition; } catch { return null; }
  }));
  const definitions = authorized.filter((definition): definition is (typeof candidates)[number] => Boolean(definition));

  return ok({ data: definitions });
}
