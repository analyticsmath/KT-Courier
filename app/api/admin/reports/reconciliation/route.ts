import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { ok, unauthorized, forbidden, badRequest } from "@/lib/api/response";
import { ReportReconciliationService } from "@/lib/reporting/reconciliation";
import { db } from "@/lib/db";
import { enforceSameOriginRequest } from "@/lib/security/request-origin";

const reconService = new ReportReconciliationService();

export async function GET() {
  const session = await getCurrentUser();
  if (!session) return unauthorized();
  if (session.role !== "ADMIN" && session.role !== "SUPER_ADMIN") {
    return forbidden("Admin access required.");
  }

  const cases = await db.reportReconciliationCase.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return ok({ data: cases });
}

export async function POST(req: NextRequest) {
  const originFailure = await enforceSameOriginRequest(req);
  if (originFailure) return originFailure;

  const session = await getCurrentUser();
  if (!session) return unauthorized();
  if (session.role !== "ADMIN" && session.role !== "SUPER_ADMIN") {
    return forbidden("Admin access required.");
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    // optional body
  }

  const action = body.action || "SCAN";

  try {
    if (action === "SCAN") {
      const result = await reconService.scanReconciliation(body.dryRun !== false);
      return ok({ data: result });
    }

    if (action === "CANCEL_STUCK_JOB" && body.jobId) {
      await reconService.cancelStuckJob(body.jobId);
      return ok({ message: `Cancelled stuck job ${body.jobId}` });
    }

    if (action === "RETRY_GENERATION" && body.jobId) {
      await reconService.retryGeneration(body.jobId);
      return ok({ message: `Retried generation for job ${body.jobId}` });
    }

    return badRequest(`Unknown action: ${action}`);
  } catch (err: any) {
    return badRequest(err.message || "Failed to perform reconciliation action.");
  }
}
