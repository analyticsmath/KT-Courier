import { getCurrentUser } from "@/lib/auth/current-user";
import { ok, unauthorized, forbidden } from "@/lib/api/response";
import { REPORT_DEFINITIONS } from "@/lib/reporting/contracts";

export async function GET() {
  const session = await getCurrentUser();
  if (!session) return unauthorized();
  if (session.role !== "ADMIN" && session.role !== "SUPER_ADMIN") {
    return forbidden("Admin access required.");
  }

  return ok({ data: Object.values(REPORT_DEFINITIONS) });
}
