import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { ok, unauthorized, badRequest } from "@/lib/api/response";
import { ReportJobService } from "@/lib/reporting/services";
import { enforceSameOriginRequest } from "@/lib/security/request-origin";

const jobService = new ReportJobService();

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ reference: string }> }
) {
  const originFailure = await enforceSameOriginRequest(req);
  if (originFailure) return originFailure;

  const session = await getCurrentUser();
  if (!session) return unauthorized();

  const { reference } = await params;
  const isAdmin = session.role === "ADMIN" || session.role === "SUPER_ADMIN";

  try {
    const updated = await jobService.cancelJob(reference, session.id, isAdmin);
    return ok({ data: updated });
  } catch (err: any) {
    return badRequest(err.message || "Failed to cancel report job.");
  }
}
