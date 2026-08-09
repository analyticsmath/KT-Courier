import { NextRequest } from "next/server";
import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { ok, badRequest, serverError } from "@/lib/api/response";
import { ReportReconciliationService } from "@/lib/reporting/reconciliation";
import { ReportAdministrationService } from "@/lib/reporting/services";
import { enforceSameOriginRequest } from "@/lib/security/request-origin";
import { z } from "zod";

const reconService = new ReportReconciliationService();
const reportAdministration = new ReportAdministrationService();
const reconciliationActionSchema = z.object({
  action: z.enum(["SCAN", "CANCEL_STUCK_JOB", "RETRY_GENERATION"]).default("SCAN"),
  dryRun: z.boolean().optional(),
  jobId: z.string().trim().min(1).optional(),
});

export async function GET(request: NextRequest) {
  const auth = await requireAdminApiPermission(PERMISSIONS.REPORT_RECONCILIATION_READ, { request });
  if (auth.response) return auth.response;
  try { return ok({ data: await reportAdministration.listReconciliationCases() }); } catch { return serverError(); }
}

export async function POST(req: NextRequest) {
  const originFailure = await enforceSameOriginRequest(req);
  if (originFailure) return originFailure;

  const parsedBody = reconciliationActionSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsedBody.success) return badRequest("Invalid reconciliation action.");
  const body = parsedBody.data;
  const action = body.action;

  const requiredPermission = action === "CANCEL_STUCK_JOB"
    ? PERMISSIONS.REPORT_JOB_CANCEL
    : action === "RETRY_GENERATION"
      ? PERMISSIONS.REPORT_JOB_RETRY
      : PERMISSIONS.REPORT_RECONCILIATION_RETRY;
  const auth = await requireAdminApiPermission(requiredPermission, { request: req });
  if (auth.response) return auth.response;

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
  } catch {
    return badRequest("The requested reconciliation action could not be completed.");
  }
}
