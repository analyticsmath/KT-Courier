import { getCurrentUser } from "@/lib/auth/current-user";
import { ok, unauthorized } from "@/lib/api/response";
import { REPORT_DEFINITIONS } from "@/lib/reporting/contracts";

export async function GET() {
  const session = await getCurrentUser();
  if (!session) return unauthorized();

  const role = session.role;
  const definitions = Object.values(REPORT_DEFINITIONS).filter((def) => {
    if (role === "ADMIN" || role === "SUPER_ADMIN") return true;
    if (role === "CUSTOMER" && def.audience === "CUSTOMER") return true;
    if (role === "STORE" && (def.audience === "STORE" || def.audience === "CUSTOMER")) return true;
    if (role === "DRIVER" && def.audience === "DRIVER") return true;
    if (role === "PROMOTER" && def.audience === "PROMOTER") return true;
    if (def.audience === "DEVELOPER") return true;
    return false;
  });

  return ok({ data: definitions });
}
